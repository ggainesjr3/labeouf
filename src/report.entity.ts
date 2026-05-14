import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export type ReportContentType = 'post' | 'reply';
export type ReportStatus = 'pending' | 'approved' | 'rejected';

@Entity('reports')
@Unique(['userId', 'contentType', 'contentId'])
@Index(['userId'])
@Index(['contentId'])
@Index(['status'])
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @Column({ type: 'varchar', length: 16 })
  contentType: ReportContentType;

  @Column({ type: 'varchar', length: 64 })
  contentId: string;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReportStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
