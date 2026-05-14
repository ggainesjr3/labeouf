import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface AlertPayload {
  text: string;
  entropy: number;
  timestamp: string;
  label: string;
  flags: string[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly webhookUrl = process.env.WEBHOOK_URL;

  constructor(private readonly httpService: HttpService) {}

  async sendAlert(payload: AlertPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('[NotificationService] WEBHOOK_URL is not set — alert skipped.');
      return;
    }

    try {
      await firstValueFrom(
        this.httpService.post(this.webhookUrl, {
          event: 'CRITICAL_ANOMALY',
          timestamp: payload.timestamp,
          text: payload.text,
          entropy: payload.entropy,
          label: payload.label,
          flags: payload.flags,
        }),
      );
      this.logger.log(`[NotificationService] Alert sent successfully for entropy: ${payload.entropy}`);
    } catch (err) {
      this.logger.error(
        `[NotificationService] Failed to send alert: ${err.message}`,
        err.stack,
      );
    }
  }
}
