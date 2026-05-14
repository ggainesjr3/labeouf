import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Report, ReportContentType, ReportStatus } from './report.entity';
import { Post } from './post.entity';
import { Reply } from './reply.entity';

const APPROVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report) private readonly reportRepository: Repository<Report>,
    @InjectRepository(Post) private readonly postRepository: Repository<Post>,
    @InjectRepository(Reply) private readonly replyRepository: Repository<Reply>,
  ) {}

  private normalizeContentId(contentId: string): string {
    const trimmed = String(contentId).trim();
    if (!trimmed) throw new BadRequestException('contentId is required');
    return trimmed;
  }

  private async assertContentExists(contentType: ReportContentType, contentId: string): Promise<void> {
    const idNum = parseInt(contentId, 10);
    if (Number.isNaN(idNum) || String(idNum) !== contentId) {
      throw new BadRequestException('contentId must be a numeric id');
    }
    if (contentType === 'post') {
      const post = await this.postRepository.findOne({ where: { id: idNum } });
      if (!post) throw new NotFoundException('Post not found');
      return;
    }
    const reply = await this.replyRepository.findOne({ where: { id: idNum } });
    if (!reply) throw new NotFoundException('Reply not found');
  }

  async createReport(userId: number, contentType: ReportContentType, contentId: string, reason: string): Promise<Report> {
    if (contentType !== 'post' && contentType !== 'reply') {
      throw new BadRequestException('contentType must be post or reply');
    }
    const r = String(reason ?? '').trim();
    if (!r) throw new BadRequestException('reason is required');

    const normalizedId = this.normalizeContentId(contentId);
    await this.assertContentExists(contentType, normalizedId);

    const existing = await this.reportRepository.findOne({
      where: { user: { id: userId }, contentType, contentId: normalizedId },
    });
    if (existing) throw new ConflictException('You have already reported this content');

    const report = this.reportRepository.create({
      user: { id: userId },
      contentType,
      contentId: normalizedId,
      reason: r,
      status: 'pending',
    });
    return this.reportRepository.save(report);
  }

  private async enrichReportRows(reports: Report[]): Promise<any[]> {
    const postIds = [...new Set(reports.filter(r => r.contentType === 'post').map(r => parseInt(r.contentId, 10)).filter(n => !Number.isNaN(n)))];
    const replyIds = [...new Set(reports.filter(r => r.contentType === 'reply').map(r => parseInt(r.contentId, 10)).filter(n => !Number.isNaN(n)))];
    const posts = postIds.length > 0 ? await this.postRepository.find({ where: { id: In(postIds) }, relations: ['author'] }) : [];
    const replies = replyIds.length > 0 ? await this.replyRepository.find({ where: { id: In(replyIds) }, relations: ['author'] }) : [];
    const pmap = new Map(posts.map(p => [p.id, p]));
    const rmap = new Map(replies.map(r => [r.id, r]));
    return reports.map(report => {
      const id = parseInt(report.contentId, 10);
      const e = report.contentType === 'post' ? pmap.get(id) : rmap.get(id);
      return {
        ...report,
        contentText: e?.text ?? '',
        contentPreview: (e?.text ?? '').slice(0, 50),
        authorUsername: (e as any)?.author?.username ?? '',
        authorDisplayName: (e as any)?.author?.displayName ?? '',
      };
    });
  }

  async getReports(status?: ReportStatus, limit = 20, offset = 0, startDate?: Date, endDate?: Date): Promise<{ items: any[]; total: number }> {
    const valid: ReportStatus[] = ['pending', 'approved', 'rejected'];
    const statusFilter = status && valid.includes(status) ? status : undefined;
    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.user', 'user')
      .orderBy('report.createdAt', 'DESC')
      .skip(offset)
      .take(Math.min(Math.max(limit, 1), 100));

    if (statusFilter) qb.andWhere('report.status = :status', { status: statusFilter });
    if (startDate && endDate) qb.andWhere('report.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    else if (startDate) qb.andWhere('report.createdAt >= :startDate', { startDate });
    else if (endDate) qb.andWhere('report.createdAt <= :endDate', { endDate });

    const [items, total] = await qb.getManyAndCount();
    const enriched = await this.enrichReportRows(items);
    return { items: enriched, total };
  }

  async getReportTrends(days: number): Promise<{ date: string; count: number }[]> {
    const d = Math.min(Math.max(days, 1), 90);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - d);
    const rows = await this.reportRepository
      .createQueryBuilder('report')
      .select("to_char(date_trunc('day', report.createdAt AT TIME ZONE 'UTC'), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('report.createdAt >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();
    return rows.map(r => ({ date: r.day, count: parseInt(r.count, 10) }));
  }

  async updateReportStatus(reportId: number, newStatus: 'approved' | 'rejected'): Promise<Report> {
    if (newStatus !== 'approved' && newStatus !== 'rejected') {
      throw new BadRequestException('status must be approved or rejected');
    }
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = newStatus;
    const saved = await this.reportRepository.save(report);
    this.logger.log(`Report #${saved.id} (${saved.contentType}:${saved.contentId}) -> ${newStatus}`);
    return saved;
  }

  async deleteReport(reportId: number): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'approved') throw new BadRequestException('Only approved reports can be purged');
    const age = Date.now() - new Date(report.updatedAt).getTime();
    if (age < APPROVED_RETENTION_MS) throw new BadRequestException('Approved report can only be removed after 30 days');
    await this.reportRepository.delete({ id: reportId });
  }

  async getStats(): Promise<Record<ReportStatus, number> & { total: number }> {
    const rows = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.status')
      .getRawMany<{ status: ReportStatus; count: string }>();
    const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const row of rows) { stats[row.status] = parseInt(row.count, 10); }
    stats.total = stats.pending + stats.approved + stats.rejected;
    return stats;
  }
}
