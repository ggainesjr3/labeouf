import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';
import { Post } from './post.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark) private bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async addBookmark(userId: number, postId: number): Promise<{ bookmarked: boolean }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.bookmarkRepository.findOne({ where: { userId, postId } });
    if (existing) {
      await this.bookmarkRepository.delete({ userId, postId });
      return { bookmarked: false };
    }
    await this.bookmarkRepository.save(this.bookmarkRepository.create({ userId, postId }));
    return { bookmarked: true };
  }

  async getBookmarks(userId: number): Promise<Post[]> {
    const bookmarks = await this.bookmarkRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const ids = bookmarks.map(b => b.postId);
    if (ids.length === 0) return [];

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.id IN (:...ids)', { ids })
      .getMany();

    const order = new Map(ids.map((id, i) => [id, i]));
    posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return posts;
  }
}
