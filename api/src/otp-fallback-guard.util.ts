import { isWhatsAppConfigured } from './notifications/whatsapp-provider.util';

// NFR-005a — the OTP fallback code (see auth/otp.service.ts) is a fixed,
// publicly-known value issued whenever no WhatsApp channel is configured.
// That's fine for local dev, but reachable in production it would let
// anyone log in as any user. ONB-014's audit-log entry only records that
// it happened after the fact; this is the boot-time guard that stops a
// misconfigured production deploy from ever reaching that state, short of
// an explicit, deliberate override.
export function assertOtpFallbackNotReachableInProduction(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  // NOT-013 — resolves Meta *or* Wasender, and treats placeholder values
  // ("...", "changeme", "your-...") as unset. The previous truthiness check
  // on the two Meta vars passed happily while WHATSAPP_ACCESS_TOKEN was the
  // literal string "...", so this guard was inert exactly when it mattered.
  if (isWhatsAppConfigured(env)) return;
  if (env.ALLOW_OTP_FALLBACK_IN_PRODUCTION === 'true') return;
  throw new Error(
    'refusing to start: NODE_ENV=production but no WhatsApp transport is configured ' +
      '(set WHATSAPP_PROVIDER=meta with WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID, ' +
      'or WHATSAPP_PROVIDER=wasender with WASENDER_API_KEY), ' +
      'which would leave the fixed fallback OTP code (1928) reachable for every login. ' +
      'Configure a provider, or set ALLOW_OTP_FALLBACK_IN_PRODUCTION=true to override deliberately.',
  );
}
