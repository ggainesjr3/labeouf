import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type ModerationContentType = 'post' | 'reply' | 'image';
export type ModerationDecision = 'approved' | 'rejected';

@Entity('moderation_logs')
@Index(['contentId', 'createdAt'])
@Index(['decision', 'createdAt'])
export class ModerationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 16 })
  contentType: ModerationContentType;

  /** UUID string identifying the moderation target (or synthetic id for pre-persist text checks). */
  @Column({ type: 'varchar', length: 36 })
  contentId: string;

  @Column({ type: 'varchar', length: 20 })
  decision: ModerationDecision;

  @Column({ type: 'varchar', length: 512 })
  reason: string;

  @Column({ type: 'varchar', length: 64 })
  detectionMethod: string;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @Column({ type: 'jsonb', nullable: true })
  rawResult: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
