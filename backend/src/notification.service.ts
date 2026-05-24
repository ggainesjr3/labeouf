import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { User } from './user.entity';

export interface AlertPayload {
  text: string;
  entropy: number;
  timestamp: string;
  label: string;
  flags: string[];
}

const APP_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ||
  'https://superb-patience-production-3fab.up.railway.app';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly webhookUrl = process.env.WEBHOOK_URL;
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

  private getMailer(): nodemailer.Transporter | null {
    const user = process.env.GMAIL_USER;
    if (!user) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
    }
    return this.transporter;
  }

  async sendPlainEmail(to: string, subject: string, text: string): Promise<void> {
    const mailer = this.getMailer();
    if (!mailer || !to?.trim()) return;

    try {
      await mailer.sendMail({
        from: `"LaBeouf" <${process.env.GMAIL_USER}>`,
        to: to.trim(),
        subject,
        text,
      });
      this.logger.log(`[NotificationService] Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`[NotificationService] Email failed for ${to}: ${err.message}`);
    }
  }

  private async emailUser(userId: number, subject: string, body: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.email) return;
    const text = `${body}\n\nOpen LaBeouf: ${APP_URL}`;
    await this.sendPlainEmail(user.email, subject, text);
  }

  async notifyFollow(recipientId: number, actorUsername: string): Promise<void> {
    await this.emailUser(
      recipientId,
      'New follower on LaBeouf',
      `@${actorUsername} started following you.`,
    );
  }

  async notifyLike(recipientId: number, actorUsername: string): Promise<void> {
    await this.emailUser(
      recipientId,
      'Someone liked your post on LaBeouf',
      `@${actorUsername} liked your post.`,
    );
  }

  async notifyReply(recipientId: number, actorUsername: string): Promise<void> {
    await this.emailUser(
      recipientId,
      'New reply on LaBeouf',
      `@${actorUsername} replied to your post.`,
    );
  }

  async notifyMessage(recipientId: number, actorUsername: string): Promise<void> {
    await this.emailUser(
      recipientId,
      'New message on LaBeouf',
      `@${actorUsername} sent you a message.`,
    );
  }
}
