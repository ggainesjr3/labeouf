import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './report.entity';
import { Post } from './post.entity';
import { Reply } from './reply.entity';
import { User } from './user.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Post, Reply, User])],
  controllers: [ReportsController],
  providers: [ReportsService, AdminGuard, JwtAuthGuard],
})
export class ReportsModule {}
