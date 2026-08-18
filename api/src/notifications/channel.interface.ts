// Behind this interface, the scheduler and every caller above it are
// completely ignorant of WhatsApp. Spec §7.2: "Build the notification layer
// behind a channel abstraction... Do not hardcode WhatsApp anywhere above
// the adapter." Swapping to SMS or a PWA push later means writing one new
// class here, nothing upstream changes.

export interface TemplateSendParams {
  to: string; // E.164 mobile
  templateName: string;
  languageCode: string;
  /** Positional {{1}}, {{2}}... substitutions for the template body. */
  bodyParams?: string[];
  /**
   * NOT-017 — a fully-rendered body to send *instead of* the template text.
   *
   * Only providers that send plain text can honour this. Wasender has no
   * template concept at all, so it sends this verbatim. Meta's Cloud API
   * cannot: outside the 24h service window only an approved template may be
   * sent, and its body is fixed at approval time — so the Meta adapter
   * ignores this and sends the approved template with bodyParams, which is
   * why bodyParams must stay populated even when an override is supplied.
   */
  bodyOverride?: string;
}

export interface FreeformSendParams {
  to: string;
  text: string;
}

export interface SendResult {
  providerMessageId: string;
}

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

export interface NotificationChannel {
  sendTemplate(params: TemplateSendParams): Promise<SendResult>;
  sendFreeform(params: FreeformSendParams): Promise<SendResult>;
}
