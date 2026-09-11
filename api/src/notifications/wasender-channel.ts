import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelUnavailableError, FreeformSendParams, NotificationChannel, SendResult, TemplateSendParams } from './channel.interface';
import { DEFAULT_MAX_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS, nextIntervalMs } from './compliance.util';

/**
 * NOT-013 — WasenderAPI transport, https://wasenderapi.com/api-docs
 *
 * A temporary stand-in while Meta Cloud API onboarding completes. It is an
 * unofficial WhatsApp-Web bridge: a real phone session relayed through their
 * servers, not the Business Platform.
 *
 * Two consequences shape this adapter:
 *
 * 1. THERE ARE NO TEMPLATES. Everything is a plain text message. Meta's
 *    template/freeform split exists because Meta forbids freeform outside the
 *    24-hour customer-service window; Wasender has no such rule. So
 *    sendTemplate() renders the template into Arabic text rather than failing
 *    or pretending. The reactive scheduler upstream keeps making its
 *    template-vs-freeform decision — it just resolves to the same wire call
 *    here, which is exactly what the channel abstraction is for.
 *
 * 2. It is not an official Meta product. Sessions can drop (the phone must
 *    stay linked), and it carries WhatsApp ToS risk that the Cloud API does
 *    not. Fine as a bridge with no users on the platform yet; not where this
 *    should stay.
 */
const DEFAULT_BASE_URL = 'https://wasenderapi.com/api';
// Wasender's "account protection" setting caps a session at one message every
// five seconds and rejects the rest outright. 5.5s leaves headroom for clock
// skew and their own measurement window.
// COM-002 — pacing is now a jittered range, not a fixed gap. The constants
// live in compliance.util so the rule and its tests sit together.

@Injectable()
export class WasenderChannel implements NotificationChannel {
  private readonly logger = new Logger(WasenderChannel.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;

  /**
   * NOT-014 — outbound pacing, shared by every caller.
   *
   * sendDueForAllStudents loops over students awaiting each send with no gap,
   * so a run fired a dozen messages in a couple of seconds. With account
   * protection on, Wasender rejected everything after the first — "You can
   * only send 1 message every 5 seconds" — and the NOT-009 ladder then burned
   * all three retries against the same wall, marking real students
   * permanently undeliverable.
   *
   * Pacing belongs here rather than in each loop: OTP, invites, weekly
   * reports and campaigns share one WhatsApp session and therefore one rate
   * limit, so a per-loop fix would leave the others colliding.
   *
   * Static because the limit is per session, not per instance. Same
   * single-process assumption as the scheduler — two API replicas would each
   * pace independently and together exceed the limit.
   */
  private static gate: Promise<void> = Promise.resolve();
  private static lastStartedAt = 0;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('WASENDER_API_KEY');
    this.baseUrl = (this.config.get<string>('WASENDER_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const configuredMin = Number(this.config.get<string>('WASENDER_MIN_INTERVAL_MS'));
    this.minIntervalMs = Number.isFinite(configuredMin) && configuredMin >= 0 ? configuredMin : DEFAULT_MIN_INTERVAL_MS;
    const configuredMax = Number(this.config.get<string>('WASENDER_MAX_INTERVAL_MS'));
    this.maxIntervalMs = Number.isFinite(configuredMax) && configuredMax >= 0 ? configuredMax : DEFAULT_MAX_INTERVAL_MS;
  }

  /**
   * Serialises callers and spaces their *start* times by at least
   * a jittered gap. Deliberately not a token bucket: bursting is the exact
   * behaviour the provider punishes.
   */
  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const slot = WasenderChannel.gate.then(async () => {
      // COM-002 — a fresh random gap per message. A perfectly regular 5.5s
      // cadence is a machine signature; the floor is still respected, so this
      // only ever sends slower than before, never faster.
      const gap = nextIntervalMs(this.minIntervalMs, this.maxIntervalMs);
      const wait = WasenderChannel.lastStartedAt + gap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      WasenderChannel.lastStartedAt = Date.now();
    });
    // A rejected send must not wedge the queue for everything behind it.
    WasenderChannel.gate = slot.catch(() => undefined);
    return slot.then(fn);
  }

  /**
   * Wasender wants the international number in digits. Everything upstream
   * stores E.164 with a leading '+', so strip it and any separators a hand-
   * entered number may carry.
   */
  static toRecipient(mobileE164: string): string {
    return mobileE164.replace(/\D/g, '');
  }

  private async post(path: string, body: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }

    if (!res.ok || json?.success === false) {
      // Log the status and body but never the API key or the message text —
      // same discipline as the delivery log, which stores counts not content.
      this.logger.error(`Wasender send failed: ${res.status} ${raw.slice(0, 300)}`);
      const message = json?.message ?? json?.error ?? `Wasender API error ${res.status}`;

      // NOT-021 — "Your Whatsapp Session is not connected please connect your
      // session first" is the phone link having dropped, which is a property
      // of the transport rather than of this message: retrying it, or trying
      // the next student, cannot succeed until someone re-links the phone.
      // Matched on the distinctive part of the wording, loosely enough to
      // survive punctuation changes. 401/403 mean the API key itself is
      // rejected, which is equally fatal to the whole run.
      const text = String(message).toLowerCase();
      if (
        (text.includes('session') && (text.includes('not connected') || text.includes('disconnect'))) ||
        res.status === 401 ||
        res.status === 403
      ) {
        throw new ChannelUnavailableError(message);
      }
      throw new Error(message);
    }

    // Documented shape is { success: true, data: { msgId, jid, status } };
    // the Python SDK reports data.message_id. Accept either rather than
    // breaking on a field rename, and fall back to 'unknown' like the Meta
    // adapter does — the id is only used to match delivery callbacks.
    const id = json?.data?.msgId ?? json?.data?.message_id ?? json?.msgId ?? json?.data?.id;
    return { providerMessageId: id != null ? String(id) : 'unknown' };
  }

  async sendFreeform(params: FreeformSendParams): Promise<SendResult> {
    return this.schedule(() =>
      this.post('/send-message', {
        to: WasenderChannel.toRecipient(params.to),
        text: params.text,
      }),
    );
  }

  async sendTemplate(params: TemplateSendParams): Promise<SendResult> {
    return this.sendFreeform({
      to: params.to,
      // NOT-017 — there is no template concept here (see the note at the top
      // of this file), so an admin-authored body is simply the text we send.
      // Meta's adapter cannot do this and deliberately ignores the override.
      text: params.bodyOverride ?? renderTemplate(params.templateName, params.bodyParams ?? []),
    });
  }
}

/**
 * The Arabic body of each approved Meta template, rendered locally.
 *
 * Keyed by the DEFAULT template name each call site passes (the
 * WHATSAPP_TEMPLATE_* env vars override the name sent to Meta, so matching is
 * also done on the positional shape via the fallback below). Keep these in
 * step with the submitted Meta templates so the wording students see does not
 * change when the provider switches back.
 */
export function renderTemplate(templateName: string, p: string[]): string {
  switch (templateName) {
    case 'wathb_otp_login':
      return `رمز الدخول إلى وثب: ${p[0]}\nصالح لمدة ١٠ دقائق. لا تشاركه مع أحد.`;

    case 'daily_wathb_reminder':
      // p[2] (the manage link) is appended only when the caller supplies it,
      // so older call sites passing two params still render correctly.
      return `وثبتك اليومية جاهزة، ${p[0]} 🌱\n${p[1]}${p[2] ? `\n\nلإدارة الإشعارات أو إيقافها مؤقتاً: ${p[2]}` : ''}`;

    case 'weekly_report_student':
      return `تقريرك الأسبوعي، ${p[0]}:\n${p[1]}\n\n${p[2]}`;

    case 'weekly_report_supervisor':
      return `تقرير الأسبوع، ${p[0]}:\n${p[1]}\n\n${p[2]}`;

    // SUP-009 — four variants, because the right ask differs on two axes.
    // Whether they already have an account decides between "join" and "open
    // your account", and a reminder must not read as a duplicate of the first
    // message. p[0] supervisor name, p[1] student name, p[2] link.
    case 'wathb_supervisor_invite':
      return `مرحباً ${p[0]}، دعاك ${p[1]} لمتابعة تقدّمه في وثب.\nافتح الرابط لإنشاء حسابك وقبول الدعوة:\n${p[2]}`;

    case 'wathb_supervisor_invite_existing':
      return `مرحباً ${p[0]}، دعاك ${p[1]} لمتابعة تقدّمه في وثب.\nالدعوة بانتظارك في حسابك:\n${p[2]}`;

    case 'wathb_supervisor_invite_reminder':
      return `تذكير: دعوة ${p[1]} لمتابعة تقدّمه في وثب ما زالت بانتظارك.\nافتح الرابط لإنشاء حسابك وقبول الدعوة:\n${p[2]}`;

    case 'wathb_supervisor_invite_reminder_existing':
      return `تذكير: دعوة ${p[1]} لمتابعة تقدّمه في وثب ما زالت بانتظارك في حسابك:\n${p[2]}`;

    case 'wathb_campaign':
      return `${p[0]}،\n${p[1]}`;

    default:
      // An unknown template (renamed via WHATSAPP_TEMPLATE_*, or a new one
      // added without updating this map) still sends rather than throwing —
      // losing the message would be worse than losing the framing text.
      return p.filter(Boolean).join('\n');
  }
}
