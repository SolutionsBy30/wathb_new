import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

// Meta WhatsApp Cloud API webhook — verification handshake + inbound events.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
@Controller('webhooks/whatsapp')
export class WebhooksController {
  constructor(
    private notifications: NotificationsService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Meta calls this once, at setup, to prove you control the endpoint.
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge;
    }
    throw new BadRequestException('verification failed');
  }

  @Post()
  async receive(@Req() req: any, @Body() body: any, @Headers('x-hub-signature-256') signature?: string) {
    this.verifySignature(req.rawBody, signature);

    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        for (const message of value.messages ?? []) {
          await this.handleInbound(message);
        }
        for (const status of value.statuses ?? []) {
          await this.handleStatus(status);
        }
      }
    }
    return { received: true };
  }

  private verifySignature(rawBody: Buffer | undefined, signature?: string) {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) return; // dev mode — no secret configured, skip (never the case in production)
    if (!signature || !rawBody) throw new BadRequestException('missing signature');
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('invalid signature');
    }
  }

  // A tap on a quick-reply button, or any inbound message, opens the 24h
  // customer-service window — spec §7.2's central insight.
  private async handleInbound(message: { from: string }) {
    const user = await this.prisma.user.findUnique({ where: { mobileE164: `+${message.from}` } });
    if (!user) return;
    await this.notifications.recordInbound(user.id);
  }

  private async handleStatus(status: { id: string; status: string; timestamp?: string }) {
    const at = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
    if (status.status === 'delivered') await this.notifications.recordDeliveryStatus(status.id, 'delivered', at);
    if (status.status === 'read') await this.notifications.recordDeliveryStatus(status.id, 'read', at);
    if (status.status === 'failed') await this.notifications.recordDeliveryStatus(status.id, 'failed', at);
  }
}
