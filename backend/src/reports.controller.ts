import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ReportsService } from './reports.service';
import { ReportContentType, ReportStatus } from './report.entity';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  async createReport(
    @Req() req: { user: { id: number } },
    @Body()
    body: { contentType: ReportContentType; contentId: string; reason: string },
  ) {
    return this.reportsService.createReport(
      req.user.id,
      body.contentType,
      body.contentId,
      body.reason,
    );
  }

  @Get('admin/reports/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStats() {
    return this.reportsService.getStats();
  }

  @Get('admin/reports/trends')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async reportTrends(@Query('days') daysStr?: string) {
    const parsed = daysStr != null ? parseInt(daysStr, 10) : 30;
    const days = Number.isFinite(parsed) ? parsed : 30;
    return this.reportsService.getReportTrends(days);
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listReports(
    @Query('status') status?: ReportStatus,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const parsedLimit = limitStr != null ? parseInt(limitStr, 10) : 20;
    const parsedOffset = offsetStr != null ? parseInt(offsetStr, 10) : 0;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    const sd = startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined;
    const ed = endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined;
    return this.reportsService.getReports(status, limit, offset, sd, ed);
  }

  @Patch('admin/reports/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async patchReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    return this.reportsService.updateReportStatus(id, body.status);
  }
}
