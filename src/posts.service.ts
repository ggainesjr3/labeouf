import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { Post } from './post.entity';
import { Like } from './like.entity';
import { Follow } from './follow.entity';
import { Reply } from './reply.entity';
import { Repost } from './repost.entity';
import { ModerationLogService } from './moderation-log.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Like) private likeRepository: Repository<Like>,
    @InjectRepository(Follow) private followRepository: Repository<Follow>,
    @InjectRepository(Reply) private replyRepository: Repository<Reply>,
    @InjectRepository(Repost) private repostRepository: Repository<Repost>,
    private readonly moderationLogService: ModerationLogService,
  ) {}

  async createPost(authorId: number, text: string, auditMetadata: any, imageUrl?: string, videoUrl?: string): Promise<Post> {
    const contentId = randomUUID();
    await this.moderateText(text, { creatorUserId: authorId, contentType: 'post', contentId });
    const post = this.postRepository.create({
      authorId, text, auditMetadata,
      imageUrl: imageUrl ?? null,
      videoUrl: videoUrl ?? null,
    });
    return this.postRepository.save(post);
  }

  async getFeed(userId: number): Promise<any[]> {
    const follows = await this.followRepository.find({ where: { followerId: userId } });
    const followingIds = follows.map(f => f.followingId);
    followingIds.push(userId);

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId IN (:...ids)', { ids: followingIds })
      .orderBy('post.timestamp', 'DESC')
      .take(50)
      .getMany();

    const reposts = await this.repostRepository
      .createQueryBuilder('repost')
      .leftJoinAndSelect('repost.post', 'post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('repost.user', 'user')
      .where('repost.userId IN (:...ids)', { ids: followingIds })
      .orderBy('repost.timestamp', 'DESC')
      .take(50)
      .getMany();

    const repostItems: any[] = reposts.map(r => ({
      ...r.post, isRepost: true, repostedBy: r.user, repostTimestamp: r.timestamp,
    }));

    const combined: any[] = [...posts, ...repostItems];
    combined.sort((a: any, b: any) => {
      const dateA = new Date(a.isRepost ? a.repostTimestamp : a.timestamp).getTime();
      const dateB = new Date(b.isRepost ? b.repostTimestamp : b.timestamp).getTime();
      return dateB - dateA;
    });
    return combined.slice(0, 50);
  }

  async getPublicFeed(): Promise<Post[]> {
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.timestamp', 'DESC')
      .take(50)
      .getMany();
  }

  async moderateText(text: string, logContext?: { creatorUserId: number; contentType: 'post' | 'reply'; contentId: string }): Promise<void> {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const contentId = logContext?.contentId ?? randomUUID();
    const contentType = logContext?.contentType ?? 'post';
    const creatorId = logContext?.creatorUserId ?? null;

    const logReject = async (params: { reason: string; detectionMethod: string; confidence: number | null; rawResult: Record<string, unknown> | null }) => {
      await this.moderationLogService.logModeration({
        userId: creatorId, contentType, contentId,
        decision: 'rejected', reason: params.reason,
        detectionMethod: params.detectionMethod,
        confidence: params.confidence, rawResult: params.rawResult,
      });
    };

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/moderations',
          { model: 'omni-moderation-latest', input: trimmed },
          { headers: { Authorization: `Bearer ${openAiKey}` } },
        );
        const result = response?.data?.results?.[0];
        if (!result) {
          await logReject({ reason: 'Unable to moderate text content', detectionMethod: 'openai_moderation', confidence: null, rawResult: response?.data ?? null });
          throw new BadRequestException('Unable to moderate text content');
        }
        const rawResult = response.data as unknown as Record<string, unknown>;
        if (result.flagged) {
          const scores = (result.category_scores ?? {}) as Record<string, number>;
          const confidence = Math.max(0, ...Object.values(scores).map(n => Number(n) || 0));
          await logReject({ reason: 'Text content not allowed: explicit or violent language detected.', detectionMethod: 'openai_moderation', confidence, rawResult });
          throw new BadRequestException('Text content not allowed: explicit or violent language detected.');
        }
        return;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const ax = err as { response?: { data?: unknown }; message?: string };
        await logReject({ reason: ax.message ?? 'OpenAI moderation request failed', detectionMethod: 'openai_moderation', confidence: null, rawResult: { error: true, message: ax.message, response: ax.response?.data ?? null } });
        throw new BadRequestException('Unable to moderate text content');
      }
    }

    const bannedTerms = ['porn', 'nude', 'naked', 'sex', 'rape', 'murder', 'gore', 'blood', 'kill', 'cannibal', 'decapitate', 'disembowel', 'suicide', 'child abuse', 'bestiality'];
    const normalized = trimmed.toLowerCase();
    for (const term of bannedTerms) {
      if (normalized.includes(term)) {
        await logReject({ reason: `Banned term match: ${term}`, detectionMethod: 'banned_terms_fallback', confidence: 1, rawResult: { bannedTermsFallback: true, matchedTerm: term, inputLength: trimmed.length } });
        throw new BadRequestException('Text content not allowed: explicit or violent language detected.');
      }
    }
  }

  async getPostsByHashtag(tag: string): Promise<Post[]> {
    const normalized = tag.trim().toLowerCase();
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('LOWER(post.text) LIKE :searchPattern', { searchPattern: `%#${normalized}%` })
      .orderBy('post.timestamp', 'DESC')
      .take(50)
      .getMany();
  }

  async getTrendingPosts(): Promise<Post[]> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.timestamp >= :cutoff', { cutoff: cutoff.toISOString() })
      .orderBy('post.likeCount', 'DESC')
      .addOrderBy('post.timestamp', 'DESC')
      .take(10)
      .getMany();
  }

  async likePost(userId: number, postId: number): Promise<{ likeCount: number }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    const existing = await this.likeRepository.findOne({ where: { userId, postId } });
    if (existing) {
      await this.likeRepository.delete({ userId, postId });
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      await this.likeRepository.save(this.likeRepository.create({ userId, postId }));
      post.likeCount += 1;
    }
    await this.postRepository.save(post);
    return { likeCount: post.likeCount };
  }

  async repostPost(userId: number, postId: number): Promise<{ reposted: boolean; repostCount: number }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    const existing = await this.repostRepository.findOne({ where: { userId, postId } });
    if (existing) {
      await this.repostRepository.delete({ userId, postId });
      post.repostCount = Math.max(0, (post.repostCount ?? 1) - 1);
      await this.postRepository.save(post);
      return { reposted: false, repostCount: post.repostCount };
    } else {
      await this.repostRepository.save(this.repostRepository.create({ userId, postId }));
      post.repostCount = (post.repostCount ?? 0) + 1;
      await this.postRepository.save(post);
      return { reposted: true, repostCount: post.repostCount };
    }
  }

  async followUser(followerId: number, followingId: number): Promise<{ following: boolean }> {
    if (followerId === followingId) throw new ForbiddenException('Cannot follow yourself');
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (existing) {
      await this.followRepository.delete({ followerId, followingId });
      return { following: false };
    } else {
      await this.followRepository.save(this.followRepository.create({ followerId, followingId }));
      return { following: true };
    }
  }

  async createReply(authorId: number, postId: number, text: string, auditMetadata: any): Promise<Reply> {
    const contentId = randomUUID();
    await this.moderateText(text, { creatorUserId: authorId, contentType: 'reply', contentId });
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    const reply = this.replyRepository.create({ authorId, postId, text, auditMetadata });
    return this.replyRepository.save(reply);
  }

  async getReplies(postId: number): Promise<Reply[]> {
    return this.replyRepository
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.author', 'author')
      .where('reply.postId = :postId', { postId })
      .orderBy('reply.timestamp', 'ASC')
      .getMany();
  }

  async deleteReplyByIdAdmin(replyId: number): Promise<void> {
    const reply = await this.replyRepository.findOne({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('Reply not found');
    await this.replyRepository.delete({ id: replyId });
  }

  async deletePostByIdAdmin(postId: number): Promise<void> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.postRepository.delete({ id: postId });
  }
}
