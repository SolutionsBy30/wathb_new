import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface EmailSendParams {
  to: string;
  subject: string;
  text: string;
}

/**
 * NOT-012 — email as a *second* channel, never a replacement for WhatsApp.
 *
 * Deliberately generic SMTP rather than a provider SDK: the deployment is a
 * single VPS, the volume is one or two messages per student per day, and SMTP
 * keeps the choice of provider (Hostinger, SES, SendGrid, Mailgun) a matter
 * of env config rather than a code change.
 *
 * Every failure here is swallowed by the caller. Email is the secondary
 * channel — a bounce must never take down the WhatsApp send or fail the job
 * that triggered it.
 */
@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {}

  /** Configured only when a host and a from-address are both present. */
  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.from);
  }

  private get from(): string | undefined {
    return this.config.get<string>('SMTP_FROM');
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured) return null;
    if (this.transporter) return this.transporter;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      // 465 is implicit TLS; 587/25 start plaintext and upgrade via STARTTLS.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  /**
   * Returns the provider message id on success, or null when email is not
   * configured or the send failed. Never throws.
   */
  async send(params: EmailSendParams): Promise<string | null> {
    const transporter = this.getTransporter();
    if (!transporter) return null;
    try {
      const info = await transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });
      return info.messageId ?? null;
    } catch (e: any) {
      this.logger.error(`email send failed to ${params.to}: ${e?.message ?? e}`);
      return null;
    }
  }
}
