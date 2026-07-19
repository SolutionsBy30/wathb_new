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
