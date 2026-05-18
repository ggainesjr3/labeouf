import { BadRequestException } from '@nestjs/common';
import { mkdtemp, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { UploadController } from './upload.controller';

describe('UploadController', () => {
  const moderationLogService = {
    logModeration: jest.fn(),
  };

  let controller: UploadController;
  let oldVisionKey: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    oldVisionKey = process.env.GOOGLE_VISION_API_KEY;
    delete process.env.GOOGLE_VISION_API_KEY;
    controller = new UploadController(moderationLogService as any);
  });

  afterEach(() => {
    if (oldVisionKey === undefined) {
      delete process.env.GOOGLE_VISION_API_KEY;
    } else {
      process.env.GOOGLE_VISION_API_KEY = oldVisionKey;
    }
  });

  async function tempFile(filename: string, bytes: number) {
    const dir = await mkdtemp(join(tmpdir(), 'labeouf-upload-'));
    const path = join(dir, filename);
    await writeFile(path, Buffer.alloc(bytes));
    return path;
  }

  it('returns the upload URL for accepted video files', async () => {
    const path = await tempFile('clip.mp4', 1024);

    await expect(
      controller.upload(
        { user: { id: 1 } },
        { filename: 'clip.mp4', path, mimetype: 'video/mp4' },
      ),
    ).resolves.toMatchObject({
      url: '/uploads/clip.mp4',
      type: 'video',
      size: 1024,
    });

    await expect(stat(path)).resolves.toBeDefined();
  });

  it('rejects images over 5MB and removes the uploaded file', async () => {
    const path = await tempFile('too-large.png', 5 * 1024 * 1024 + 1);

    await expect(
      controller.upload(
        { user: { id: 1 } },
        { filename: 'too-large.png', path, mimetype: 'image/png' },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(stat(path)).rejects.toThrow();
  });

  it('rejects missing files', async () => {
    await expect(controller.upload({ user: { id: 1 } })).rejects.toThrow(
      BadRequestException,
    );
  });
});
