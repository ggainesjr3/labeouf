import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Audit } from './audit.entity';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(Audit)
    private auditRepository: Repository<Audit>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeStaleAuditRecords(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    try {
      const result = await this.auditRepository.delete({
        timestamp: LessThan(cutoff),
      });
      this.logger.log(
        `[Purge] Deleted ${result.affected ?? 0} audit records older than ${cutoff.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(`[Purge] Failed to delete stale records: ${err.message}`, err.stack);
    }
  }
}
