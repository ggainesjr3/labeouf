import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationLog } from './moderation-log.entity';
import { User } from './user.entity';
import { ModerationLogService } from './moderation-log.service';
import { ModerationLogController } from './moderation-log.controller';
import { AdminNotFoundGuard } from './admin-not-found.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationLog, User])],
  controllers: [ModerationLogController],
  providers: [ModerationLogService, AdminNotFoundGuard, JwtAuthGuard],
  exports: [ModerationLogService],
})
export class ModerationLogModule {}
