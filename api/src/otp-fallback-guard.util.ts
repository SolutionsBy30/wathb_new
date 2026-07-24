// NFR-005a — the OTP fallback code (see auth/otp.service.ts) is a fixed,
// publicly-known value issued whenever no WhatsApp channel is configured.
// That's fine for local dev, but reachable in production it would let
// anyone log in as any user. ONB-014's audit-log entry only records that
// it happened after the fact; this is the boot-time guard that stops a
// misconfigured production deploy from ever reaching that state, short of
// an explicit, deliberate override.
export function assertOtpFallbackNotReachableInProduction(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  const whatsappConfigured = !!env.WHATSAPP_ACCESS_TOKEN && !!env.WHATSAPP_PHONE_NUMBER_ID;
  if (whatsappConfigured) return;
  if (env.ALLOW_OTP_FALLBACK_IN_PRODUCTION === 'true') return;
  throw new Error(
    'refusing to start: NODE_ENV=production but WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are not set, ' +
      'which would leave the fixed fallback OTP code (1928) reachable for every login. ' +
      'Configure WhatsApp credentials, or set ALLOW_OTP_FALLBACK_IN_PRODUCTION=true to override deliberately.',
  );
}
