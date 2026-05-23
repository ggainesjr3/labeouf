import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { BrowserPushSubscription, PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Request() req, @Body() subscription: BrowserPushSubscription) {
    return this.pushService.saveSubscription(req.user.id, subscription);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async send(
    @Body() body: { userId: number; title: string; message: string; data?: Record<string, unknown> },
  ) {
    await this.pushService.sendToUser(body.userId, {
      title: body.title,
      body: body.message,
      data: body.data,
    });
    return { ok: true };
  }
}
