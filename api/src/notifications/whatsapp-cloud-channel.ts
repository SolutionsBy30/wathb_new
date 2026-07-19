import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FreeformSendParams, NotificationChannel, SendResult, TemplateSendParams } from './channel.interface';

// Meta WhatsApp Business Platform (Cloud API) — see
// https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
// Requires WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID; falls back to
// ConsoleChannel (see notification-channel.provider.ts) when unset.
const GRAPH_API_VERSION = 'v21.0';

@Injectable()
export class WhatsAppCloudChannel implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppCloudChannel.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
  }

  private get endpoint() {
    return `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
  }

  private async post(body: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    });
    const json = await res.json();
    if (!res.ok) {
      this.logger.error(`WhatsApp send failed: ${res.status} ${JSON.stringify(json)}`);
      throw new Error(json?.error?.message ?? `WhatsApp API error ${res.status}`);
    }
    return { providerMessageId: json.messages?.[0]?.id ?? 'unknown' };
  }

  async sendTemplate(params: TemplateSendParams): Promise<SendResult> {
    return this.post({
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: params.bodyParams?.length
          ? [{ type: 'body', parameters: params.bodyParams.map((text) => ({ type: 'text', text })) }]
          : undefined,
      },
    });
  }

  async sendFreeform(params: FreeformSendParams): Promise<SendResult> {
    return this.post({
      to: params.to,
      type: 'text',
      text: { body: params.text },
    });
  }
}
