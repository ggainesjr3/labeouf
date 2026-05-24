import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';
import { User } from './user.entity';

export type BrowserPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.configureWebPush();
  }

  private configureWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      publicKey,
      privateKey,
    );
  }

  async saveSubscription(userId: number, subscription: BrowserPushSubscription) {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new BadRequestException('Invalid push subscription');
    }

    const existing = await this.subscriptionRepository.findOne({
      where: { endpoint: subscription.endpoint },
    });
    const entity = this.subscriptionRepository.create({
      ...(existing ?? {}),
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expirationTime: subscription.expirationTime == null ? null : String(subscription.expirationTime),
    });

    await this.subscriptionRepository.save(entity);
    return { ok: true };
  }

  async sendToUser(
    userId: number,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

    const subscriptions = await this.subscriptionRepository.find({ where: { userId } });
    await Promise.all(subscriptions.map(subscription => this.send(subscription, payload)));
  }

  async sendLikeNotification(targetUserId: number, actorUserId: number, postId: number) {
    if (targetUserId === actorUserId) return;
    const actor = await this.userRepository.findOne({ where: { id: actorUserId } });
    const name = actor?.displayName || actor?.username || 'Someone';
    await this.sendToUser(targetUserId, {
      title: 'New like',
      body: `${name} liked your post.`,
      data: { type: 'like', postId, actorUserId },
    });
  }

  async sendFollowNotification(targetUserId: number, actorUserId: number) {
    if (targetUserId === actorUserId) return;
    const actor = await this.userRepository.findOne({ where: { id: actorUserId } });
    const name = actor?.displayName || actor?.username || 'Someone';
    await this.sendToUser(targetUserId, {
      title: 'New follower',
      body: `${name} followed you.`,
      data: { type: 'follow', actorUserId },
    });
  }

  private async send(
    subscription: PushSubscription,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ? Number(subscription.expirationTime) : null,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload),
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionRepository.delete({ id: subscription.id });
        return;
      }
      this.logger.warn(`Failed to send web push notification: ${(err as Error).message}`);
    }
  }
}
