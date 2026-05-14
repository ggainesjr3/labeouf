import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './like.entity';
import { Follow } from './follow.entity';
import { Post } from './post.entity';
import { User } from './user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getNotifications(userId: number) {
    const [myPosts, followers] = await Promise.all([
      this.postRepository.find({ where: { authorId: userId }, select: ['id', 'text'] }),
      this.followRepository.find({ where: { followingId: userId } }),
    ]);

    const myPostIds = myPosts.map((p) => p.id);

    const likes = myPostIds.length
      ? await this.likeRepository
          .createQueryBuilder('like')
          .where('like.postId IN (:...ids)', { ids: myPostIds })
          .andWhere('like.userId != :userId', { userId })
          .orderBy('like.createdAt', 'DESC')
          .take(30)
          .getMany()
      : [];

    const likerIds = [...new Set(likes.map((l) => l.userId))];
    const followerIds = [...new Set(followers.map((f) => f.followerId))];
    const allUserIds = [...new Set([...likerIds, ...followerIds])];

    const users = allUserIds.length
      ? await this.userRepository
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: allUserIds })
          .select(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl'])
          .getMany()
      : [];

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const postMap = Object.fromEntries(myPosts.map((p) => [p.id, p]));

    const likeNotifs = likes.map((l) => ({
      type: 'like',
      id: `like-${l.id}`,
      actor: userMap[l.userId],
      post: postMap[l.postId],
      createdAt: l.createdAt,
    }));

    const followNotifs = followers.map((f) => ({
      type: 'follow',
      id: `follow-${f.id}`,
      actor: userMap[f.followerId],
      createdAt: f.createdAt,
    }));

    return [...likeNotifs, ...followNotifs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }
}
