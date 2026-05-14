import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { PostsController } from './posts.controller';
import { UsersController } from './users.controller';
import { NotificationsController } from './notifications.controller';
import { MessagesController } from './messages.controller';
import { UploadController } from './upload.controller';
import { BookmarksController } from './bookmarks.controller';
import { ReportsController } from './reports.controller';
import { ModerationLogController } from './moderation-log.controller';

import { MaintenanceService } from './maintenance.service';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { PostsService } from './posts.service';
import { UsersService } from './users.service';
import { NotificationsService } from './notifications.service';
import { MessagesService } from './messages.service';
import { BookmarksService } from './bookmarks.service';
import { ReportsService } from './reports.service';
import { ModerationLogService } from './moderation-log.service';
import { BrainService } from './brain.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminNotFoundGuard } from './admin-not-found.guard';

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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'labeouf-secret-change-in-prod',
      signOptions: { expiresIn: '7d' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        Audit, User, Post, Like, Follow, Reply, Repost,
        Message, Bookmark, Report, ModerationLog,
      ],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([
      Audit, User, Post, Like, Follow, Reply, Repost,
      Message, Bookmark, Report, ModerationLog,
    ]),
  ],
  controllers: [
    AppController,
    AuthController,
    PostsController,
    UsersController,
    NotificationsController,
    MessagesController,
    UploadController,
    BookmarksController,
    ReportsController,
    ModerationLogController,
  ],
  providers: [
    MaintenanceService,
    NotificationService,
    AuthService,
    PostsService,
    UsersService,
    NotificationsService,
    MessagesService,
    BookmarksService,
    ReportsService,
    ModerationLogService,
    BrainService,
    JwtStrategy,
    GoogleStrategy,
    JwtAuthGuard,
    AdminGuard,
    AdminNotFoundGuard,
  ],
})
export class AppModule {}
