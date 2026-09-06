import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelUnavailableError,
  FreeformSendParams,
  NotificationChannel,
  SendResult,
  TemplateSendParams,
  isChannelUnavailable,
} from './channel.interface';
import { ProviderSettingsService } from './provider-settings.service';

/**
 * NOT-023 — sends through the primary sender, falling back to the backup.
 *
 * A Wasender session is a real phone that can drop at any hour. Until now that
 * meant the day's leaps went nowhere; with a second configured sender the
 * fallback is automatic and nobody has to be awake for it.
 *
 * Failover is deliberately narrow: only a ChannelUnavailableError — the
 * transport itself being unusable — moves to the backup. An ordinary failure
 * (a wrong number, a rate limit) is that message's own problem and retrying it
 * on a second sender would just deliver the same rejection twice.
 */
@Injectable()
export class RoutingChannel implements NotificationChannel {
  private readonly logger = new Logger(RoutingChannel.name);

  constructor(private settings: ProviderSettingsService) {}

  sendTemplate(params: TemplateSendParams): Promise<SendResult> {
    return this.viaFirstWorking((c) => c.sendTemplate(params));
  }

  sendFreeform(params: FreeformSendParams): Promise<SendResult> {
    return this.viaFirstWorking((c) => c.sendFreeform(params));
  }

  private async viaFirstWorking(send: (c: NotificationChannel) => Promise<SendResult>): Promise<SendResult> {
    const rows = (await this.settings.list())
      .filter((r) => r.isActive && this.settings.isConfigured(r))
      // primary before backup; nothing else is a valid role today.
      .sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0));

    if (rows.length === 0) {
      throw new ChannelUnavailableError('no active WhatsApp sender is configured');
    }

    let lastUnavailable: unknown = null;
    for (const row of rows) {
      const channel = this.settings.buildChannel(row);
      if (!channel) continue;
      try {
        const result = await send(channel);
        // A send that worked is the strongest health signal there is —
        // stronger than any probe — so it clears a stale 'disconnected'.
        if (row.status !== 'connected') await this.settings.record(row.role, 'connected', null);
        if (row.role !== 'primary') {
          this.logger.warn(`sent via the ${row.role} sender — the primary is unavailable`);
        }
        return result;
      } catch (e) {
        if (isChannelUnavailable(e)) {
          this.logger.error(`${row.role} sender unavailable: ${(e as Error).message}`);
          await this.settings.record(row.role, 'disconnected', (e as Error).message);
          lastUnavailable = e;
          continue; // try the next sender
        }
        throw e; // this message's own failure — do not retry it elsewhere
      }
    }

    // Every sender is down. Callers stop their batch on this rather than
    // walking the roster into the same wall.
    throw lastUnavailable instanceof Error
      ? new ChannelUnavailableError(lastUnavailable.message)
      : new ChannelUnavailableError('every configured WhatsApp sender is unavailable');
  }
}
