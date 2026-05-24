import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './user.entity';
import { Post } from './post.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async search(q: string) {
    const term = (q || '').trim();
    if (!term) {
      return { users: [], posts: [] };
    }

    const pattern = `%${term}%`;

    const [users, posts] = await Promise.all([
      this.userRepository.find({
        where: [{ username: ILike(pattern) }, { displayName: ILike(pattern) }],
        select: ['id', 'username', 'displayName', 'avatarUrl', 'bio'],
        take: 10,
      }),
      this.postRepository
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .where('post.text ILIKE :pattern', { pattern })
        .orderBy('post.timestamp', 'DESC')
        .take(10)
        .getMany(),
    ]);

    return { users, posts };
  }
}
