/**
 * NOT-013 — which WhatsApp transport is live.
 *
 * Meta Cloud API onboarding (business verification, template approval) can
 * take weeks. WasenderAPI is an unofficial WhatsApp-Web bridge that needs
 * none of that, so it stands in until Meta is ready. Both adapters stay in
 * the tree; this switch decides which one is wired up.
 *
 * SECURITY — this is not just a routing choice. auth/otp.service.ts issues
 * the fixed, publicly-known fallback code (1928) whenever it believes no
 * WhatsApp channel exists, and main.ts refuses to boot in production in that
 * state. Both used to test the two Meta env vars directly, so switching to
 * Wasender would have silently made every login OTP the same known value.
 * All three call sites now resolve through this one function.
 *
 * Pure, env-in/answer-out, so the security-relevant decision is unit-tested
 * rather than inferred from behaviour.
 */
export type WhatsAppProvider = 'meta' | 'wasender' | 'none';

/**
 * Placeholder values are treated as unset. `WHATSAPP_ACCESS_TOKEN=...` is a
 * non-empty string, so a plain truthiness check called it configured and the
 * API spent a day POSTing the literal "..." to Meta as a phone number id.
 */
export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v === '') return true;
  if (/^\.+$/.test(v)) return true; // "...", "."
  if (/^(changeme|placeholder|your[-_].*|xxx+|todo)$/i.test(v)) return true;
  return false;
}

function metaConfigured(env: NodeJS.ProcessEnv): boolean {
  return !isPlaceholder(env.WHATSAPP_ACCESS_TOKEN) && !isPlaceholder(env.WHATSAPP_PHONE_NUMBER_ID);
}

function wasenderConfigured(env: NodeJS.ProcessEnv): boolean {
  return !isPlaceholder(env.WASENDER_API_KEY);
}

/**
 * WHATSAPP_PROVIDER is the deliberate switch: 'wasender' | 'meta' | 'none'.
 * A named provider whose credentials are missing resolves to 'none' rather
 * than silently falling through to the other one — a misconfigured switch
 * should stop sends and trip the boot guard, not quietly route production
 * traffic somewhere the operator didn't choose.
 *
 * Unset keeps the previous behaviour exactly: Meta if configured, else none.
 */
export function resolveWhatsAppProvider(env: NodeJS.ProcessEnv): WhatsAppProvider {
  const explicit = env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (explicit === 'none') return 'none';
  if (explicit === 'wasender') return wasenderConfigured(env) ? 'wasender' : 'none';
  if (explicit === 'meta') return metaConfigured(env) ? 'meta' : 'none';
  return metaConfigured(env) ? 'meta' : 'none';
}

/** True when a real outbound WhatsApp transport is wired up. */
export function isWhatsAppConfigured(env: NodeJS.ProcessEnv): boolean {
  return resolveWhatsAppProvider(env) !== 'none';
}
