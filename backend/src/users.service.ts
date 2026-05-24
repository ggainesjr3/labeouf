import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './user.entity';
import { Post } from './post.entity';
import { Follow } from './follow.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
  ) {}

  async searchUsers(q: string) {
    return this.userRepository.find({
      where: [{ username: ILike(`%${q}%`) }, { displayName: ILike(`%${q}%`) }],
      select: ['id', 'username', 'displayName', 'avatarUrl', 'bio'],
      take: 10,
    });
  }

  async getProfile(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
      select: ['id', 'username', 'displayName', 'avatarUrl', 'bio', 'createdAt'],
    });
    if (!user) throw new NotFoundException('User not found');

    const [followerCount, followingCount, postCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: user.id } }),
      this.followRepository.count({ where: { followerId: user.id } }),
      this.postRepository.count({ where: { authorId: user.id } }),
    ]);

    return { ...user, followerCount, followingCount, postCount };
  }

  async getMe(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username', 'displayName', 'avatarUrl', 'bio', 'role', 'createdAt'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, data: { displayName?: string; bio?: string; avatarUrl?: string }) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    const saved = await this.userRepository.save(user);
    return { id: saved.id, username: saved.username, displayName: saved.displayName, bio: saved.bio, avatarUrl: saved.avatarUrl };
  }

  async getUserPosts(username: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId = :id', { id: user.id })
      .orderBy('post.timestamp', 'DESC')
      .take(50)
      .getMany();
  }

  async getFollowers(username: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    const follows = await this.followRepository.find({ where: { followingId: user.id } });
    const ids = follows.map(f => f.followerId);
    if (!ids.length) return [];
    return this.userRepository.createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids })
      .select(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl', 'user.bio'])
      .getMany();
  }

  async getFollowing(username: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    const follows = await this.followRepository.find({ where: { followerId: user.id } });
    const ids = follows.map(f => f.followingId);
    if (!ids.length) return [];
    return this.userRepository.createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids })
      .select(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl', 'user.bio'])
      .getMany();
  }

  async promoteToAdmin(username: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    user.role = 'admin';
    await this.userRepository.save(user);
    return { ok: true, username: user.username, role: user.role };
  }
}
