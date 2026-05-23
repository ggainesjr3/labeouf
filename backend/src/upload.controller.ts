import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { readFile, stat, unlink } from 'fs/promises';
import { extname, join } from 'path';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { ModerationLogService } from './moderation-log.service';

const UPLOAD_ROOT = process.env.UPLOAD_PATH || join(process.cwd(), 'uploads');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];

const VISION_ANNOTATE = 'https://vision.googleapis.com/v1/images:annotate';

function likelihoodScore(label: string | undefined): number {
  const map: Record<string, number> = {
    UNKNOWN: 0.25,
    VERY_UNLIKELY: 0.05,
    UNLIKELY: 0.15,
    POSSIBLE: 0.55,
    LIKELY: 0.85,
    VERY_LIKELY: 1,
  };
  return map[label ?? 'UNKNOWN'] ?? 0.25;
}

function ensureUploadDir() {
  if (!existsSync(UPLOAD_ROOT)) {
    mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
}

@Controller('upload')
export class UploadController {
  constructor(private readonly moderationLogService: ModerationLogService) {}

  /**
   * Google Vision safe search; logs approval and rejection with scores in rawResult.
   */
  private async moderateImage(
    uploaderId: number,
    file: { path: string; filename: string },
    apiKey: string,
  ): Promise<void> {
    const contentId = randomUUID();
    const buf = await readFile(file.path);
    const base64 = buf.toString('base64');

    const { data } = await axios.post(
      `${VISION_ANNOTATE}?key=${encodeURIComponent(apiKey)}`,
      {
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'SAFE_SEARCH_DETECTION', maxResults: 16 }],
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const response0 = data?.responses?.[0];
    const err = response0?.error;
    if (err) {
      await this.moderationLogService.logModeration({
        userId: uploaderId,
        contentType: 'image',
        contentId,
        decision: 'rejected',
        reason: typeof err.message === 'string' ? err.message : 'Google Vision API error',
        detectionMethod: 'google_vision',
        confidence: null,
        rawResult: { visionResponse: data, error: err } as Record<string, unknown>,
      });
      await unlink(file.path).catch(() => {});
      throw new BadRequestException('Image moderation failed');
    }

    const ann = response0?.safeSearchAnnotation as Record<string, string> | undefined;
    const keys = ['adult', 'violence', 'racy'] as const;
    const bad = (v: string | undefined) => v === 'LIKELY' || v === 'VERY_LIKELY';
    const rejected = keys.some(k => bad(ann?.[k]));
    const confidence = Math.max(0, ...keys.map(k => likelihoodScore(ann?.[k])));

    const rawResult = {
      visionResponse: data,
      safeSearchScores: ann ?? null,
      filename: file.filename,
    } as Record<string, unknown>;

    if (rejected) {
      await this.moderationLogService.logModeration({
        userId: uploaderId,
        contentType: 'image',
        contentId,
        decision: 'rejected',
        reason: 'Image failed safe search (adult / violence / racy)',
        detectionMethod: 'google_vision',
        confidence,
        rawResult,
      });
      await unlink(file.path).catch(() => {});
      throw new BadRequestException('Image not allowed');
    }

    await this.moderationLogService.logModeration({
      userId: uploaderId,
      contentType: 'image',
      contentId,
      decision: 'approved',
      reason: 'Image passed safe search',
      detectionMethod: 'google_vision',
      confidence,
      rawResult,
    });
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_ROOT);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: VIDEO_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (IMAGE_MIMES.has(file.mimetype)) {
          if (!IMAGE_EXTS.includes(ext)) {
            cb(new BadRequestException('Only jpg, png, gif, and webp images are allowed'), false);
            return;
          }
          cb(null, true);
          return;
        }
        if (VIDEO_MIMES.has(file.mimetype)) {
          if (!VIDEO_EXTS.includes(ext)) {
            cb(new BadRequestException('Only mp4, webm, and mov videos are allowed'), false);
            return;
          }
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Only images (jpg, png, gif, webp) or videos (mp4, webm, mov) are allowed',
          ),
          false,
        );
      },
    }),
  )
  async upload(
    @Req() req: { user: { id: number } },
    @UploadedFile() file?: { filename: string; path: string; mimetype: string },
  ) {
    if (!file?.filename || !file.path) {
      throw new BadRequestException('No file uploaded');
    }

    const { size } = await stat(file.path);
    if (IMAGE_MIMES.has(file.mimetype)) {
      if (size > IMAGE_MAX_BYTES) {
        await unlink(file.path).catch(() => {});
        throw new BadRequestException('Image must be 5MB or smaller');
      }
    } else if (VIDEO_MIMES.has(file.mimetype)) {
      if (size > VIDEO_MAX_BYTES) {
        await unlink(file.path).catch(() => {});
        throw new BadRequestException('Video must be 50MB or smaller');
      }
    }

    const visionKey = process.env.GOOGLE_VISION_API_KEY;
    if (visionKey && IMAGE_MIMES.has(file.mimetype)) {
      try {
        await this.moderateImage(req.user.id, file, visionKey);
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        await this.moderationLogService
          .logModeration({
            userId: req.user.id,
            contentType: 'image',
            contentId: randomUUID(),
            decision: 'rejected',
            reason: e instanceof Error ? e.message : 'Vision request failed',
            detectionMethod: 'google_vision',
            confidence: null,
            rawResult: { error: String(e) } as Record<string, unknown>,
          })
          .catch(() => {});
        await unlink(file.path).catch(() => {});
        throw new BadRequestException('Image moderation failed');
      }
    }

    return {
      url: `/uploads/${file.filename}`,
      type: IMAGE_MIMES.has(file.mimetype) ? 'image' : 'video',
      size,
    };
  }
}
