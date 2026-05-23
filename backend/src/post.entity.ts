import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  videoUrl: string | null;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  repostCount: number;

  @Column({ type: 'jsonb', default: '{}' })
  auditMetadata: {
    label: string;
    score: number;
    entropy: number;
    is_panic: boolean;
    flags: string[];
  };

  @CreateDateColumn()
  timestamp: Date;
}
