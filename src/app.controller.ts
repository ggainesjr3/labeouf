import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Audit } from './audit.entity';
import { NotificationService } from './notification.service';
import { BrainService } from './brain.service';

const requestCounts = new Map<string, { count: number; lastReset: number }>();
const PANIC_ENTROPY_THRESHOLD = 5.0;

@Controller('audit')
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @InjectRepository(Audit)
    private auditRepository: Repository<Audit>,
    private readonly notificationService: NotificationService,
    private readonly brainService: BrainService,
  ) {}

  @Post()
  async audit(@Body() body: { text: string }) {
    const clientKey = 'global';
    const now = Date.now();
    const windowMs = 60000;
    const limit = 10;

    const record = requestCounts.get(clientKey) || { count: 0, lastReset: now };
    if (now - record.lastReset > windowMs) {
      record.count = 0;
      record.lastReset = now;
    }

    if (record.count >= limit) {
      throw new HttpException('Tactical Rate Limit Exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    record.count++;
    requestCounts.set(clientKey, record);

    const result = await this.brainService.analyze(body.text);
    const isPanic = result.entropy > PANIC_ENTROPY_THRESHOLD;

    if (isPanic) {
      result.label = 'CRITICAL_ANOMALY';
      this.logger.warn(
        `[SECURITY_ALERT] PANIC THRESHOLD BREACHED — ` +
        `entropy: ${result.entropy} | ` +
        `threshold: ${PANIC_ENTROPY_THRESHOLD} | ` +
        `input snippet: "${body.text.substring(0, 40)}..."`,
      );
    }

    const flags = [
      ...(result.label === 'ANOMALOUS_DATA' || result.label === 'CRITICAL_ANOMALY'
        ? ['high_entropy_detected'] : []),
      ...(isPanic ? ['panic_threshold_breached'] : []),
    ];

    const timestamp = new Date().toISOString();

    const auditEntry = this.auditRepository.create({
      text: body.text,
      label: result.label,
      confidence: result.score,
      metadata: {
        model: 'vader-hardened-v1.6.1-entropy-shield',
        entropy: result.entropy,
        is_panic: isPanic,
        flags,
      },
    });

    const saved = await this.auditRepository.save(auditEntry);

    if (isPanic) {
      this.notificationService.sendAlert({
        text: body.text,
        entropy: result.entropy,
        timestamp,
        label: result.label,
        flags,
      }).catch((err) => {
        this.logger.error(`[NotificationService] Unhandled alert error: ${err.message}`);
      });
    }

    return saved;
  }
}
