import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminNotFoundGuard } from './admin-not-found.guard';
import { ModerationLogService } from './moderation-log.service';
import { ModerationDecision } from './moderation-log.entity';

@Controller()
export class ModerationLogController {
  constructor(private readonly moderationLogService: ModerationLogService) {}

  @Get('admin/moderation-logs/charts')
  @UseGuards(JwtAuthGuard, AdminNotFoundGuard)
  async charts() {
    return this.moderationLogService.getChartBreakdown();
  }

  @Get('admin/moderation-logs/stats')
  @UseGuards(JwtAuthGuard, AdminNotFoundGuard)
  async getStats() {
    return this.moderationLogService.getStats();
  }

  @Get('admin/moderation-logs')
  @UseGuards(JwtAuthGuard, AdminNotFoundGuard)
  async listLogs(
    @Query('method') method?: string,
    @Query('decision') decision?: ModerationDecision,
    @Query('status') status?: ModerationDecision,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const parsedLimit = limitStr != null ? parseInt(limitStr, 10) : 20;
    const parsedOffset = offsetStr != null ? parseInt(offsetStr, 10) : 0;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const validDecisions: ModerationDecision[] = ['approved', 'rejected'];
    const rawDecision = decision ?? status;
    const decisionFilter =
      rawDecision && validDecisions.includes(rawDecision) ? rawDecision : undefined;

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    return this.moderationLogService.getLogs(
      {
        decision: decisionFilter,
        detectionMethod: method,
        startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
        endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
      },
      limit,
      offset,
    );
  }
}
