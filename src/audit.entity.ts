import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audits')
export class Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 64 })
  label: string;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: {
    model: string;
    entropy: number;
    is_panic: boolean;
    flags: string[];
  };

  @CreateDateColumn()
  timestamp: Date;
}
