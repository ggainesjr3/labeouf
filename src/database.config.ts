import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

import { Audit } from './audit.entity';
import { User } from './user.entity';
import { Post } from './post.entity';
import { Like } from './like.entity';
import { Follow } from './follow.entity';
import { Reply } from './reply.entity';
import { Repost } from './repost.entity';
import { Message } from './message.entity';
import { Bookmark } from './bookmark.entity';
import { Report } from './report.entity';
import { ModerationLog } from './moderation-log.entity';

export const entities = [
  Audit,
  User,
  Post,
  Like,
  Follow,
  Reply,
  Repost,
  Message,
  Bookmark,
  Report,
  ModerationLog,
];

export const databaseConfig = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities,
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
} satisfies DataSourceOptions;

export const typeOrmModuleConfig: TypeOrmModuleOptions = databaseConfig;
