import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FreeformSendParams, NotificationChannel, SendResult, TemplateSendParams } from './channel.interface';

/**
 * Default channel when no WABA credentials are configured. Logs what would
 * have been sent instead of calling Meta — safe fallback for local dev and
 * CI, and the reason ALLOW_DEV_LOGIN-style footguns can't leak a real send.
 */
@Injectable()
export class ConsoleChannel implements NotificationChannel {
  private readonly logger = new Logger('ConsoleChannel(WhatsApp stand-in)');

  async sendTemplate(params: TemplateSendParams): Promise<SendResult> {
    this.logger.log(
      `[template] to=${params.to} name=${params.templateName} lang=${params.languageCode} params=${JSON.stringify(params.bodyParams ?? [])}`,
    );
    return { providerMessageId: `console-${randomUUID()}` };
  }

  async sendFreeform(params: FreeformSendParams): Promise<SendResult> {
    this.logger.log(`[freeform] to=${params.to} text="${params.text}"`);
    return { providerMessageId: `console-${randomUUID()}` };
  }
}
