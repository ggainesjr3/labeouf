import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ModerationLog,
  ModerationContentType,
  ModerationDecision,
} from './moderation-log.entity';

export type ModerationLogFilters = {
  decision?: ModerationDecision;
  detectionMethod?: string;
  startDate?: Date;
  endDate?: Date;
};

@Injectable()
export class ModerationLogService {
  constructor(
    @InjectRepository(ModerationLog)
    private readonly logRepository: Repository<ModerationLog>,
  ) {}

  async logModeration(params: {
    userId: number | null;
    contentType: ModerationContentType;
    contentId: string;
    decision: ModerationDecision;
    reason: string;
    detectionMethod: string;
    confidence: number | null;
    rawResult: Record<string, unknown> | null;
  }): Promise<ModerationLog> {
    const entry = this.logRepository.create({
      user: params.userId != null ? { id: params.userId } : null,
      contentType: params.contentType,
      contentId: params.contentId,
      decision: params.decision,
      reason: params.reason,
      detectionMethod: params.detectionMethod,
      confidence: params.confidence,
      rawResult: params.rawResult,
    });
    return this.logRepository.save(entry);
  }

  async getLogs(
    filters?: ModerationLogFilters,
    limit = 50,
    offset = 0,
  ): Promise<{ items: ModerationLog[]; total: number }> {
    const qb = this.logRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .skip(offset)
      .take(Math.min(Math.max(limit, 1), 200));

    if (filters?.decision) {
      qb.andWhere('log.decision = :decision', { decision: filters.decision });
    }
    if (filters?.detectionMethod?.trim()) {
      qb.andWhere('log.detectionMethod = :method', { method: filters.detectionMethod.trim() });
    }
    if (filters?.startDate && filters?.endDate) {
      qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters?.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    } else if (filters?.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getStats(): Promise<{
    total: number;
    approved: number;
    rejected: number;
    byMethod: Record<string, number>;
  }> {
    const total = await this.logRepository.count();

    const byDecision = await this.logRepository
      .createQueryBuilder('log')
      .select('log.decision', 'decision')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.decision')
      .getRawMany<{ decision: ModerationDecision; count: string }>();

    let approved = 0;
    let rejected = 0;
    for (const row of byDecision) {
      const c = parseInt(row.count, 10);
      if (row.decision === 'approved') approved = c;
      if (row.decision === 'rejected') rejected = c;
    }

    const methodRows = await this.logRepository
      .createQueryBuilder('log')
      .select('log.detectionMethod', 'method')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.detectionMethod')
      .getRawMany<{ method: string; count: string }>();

    const byMethod: Record<string, number> = {};
    for (const row of methodRows) {
      byMethod[row.method] = parseInt(row.count, 10);
    }

    return { total, approved, rejected, byMethod };
  }

  async getChartBreakdown(): Promise<{
    rejectionReasons: { reason: string; count: number }[];
    methodApprovalRates: { method: string; approved: number; rejected: number; approvalRate: number }[];
  }> {
    const reasonRows = await this.logRepository
      .createQueryBuilder('log')
      .select('log.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('log.decision = :d', { d: 'rejected' })
      .groupBy('log.reason')
      .orderBy('COUNT(*)', 'DESC')
      .limit(25)
      .getRawMany<{ reason: string; count: string }>();

    const methodRows = await this.logRepository
      .createQueryBuilder('log')
      .select('log.detectionMethod', 'method')
      .addSelect("SUM(CASE WHEN log.decision = 'approved' THEN 1 ELSE 0 END)", 'approved')
      .addSelect("SUM(CASE WHEN log.decision = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .groupBy('log.detectionMethod')
      .getRawMany<{ method: string; approved: string; rejected: string }>();

    const rejectionReasons = reasonRows.map(r => ({
      reason: r.reason,
      count: parseInt(r.count, 10),
    }));

    const methodApprovalRates = methodRows.map(r => {
      const a = parseInt(r.approved, 10) || 0;
      const rej = parseInt(r.rejected, 10) || 0;
      const t = a + rej;
      return {
        method: r.method,
        approved: a,
        rejected: rej,
        approvalRate: t > 0 ? Math.round((a / t) * 1000) / 10 : 0,
      };
    });

    return { rejectionReasons, methodApprovalRates };
  }
}
