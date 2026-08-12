import { assertOtpFallbackNotReachableInProduction } from './otp-fallback-guard.util';

describe('assertOtpFallbackNotReachableInProduction', () => {
  it('allows boot outside production regardless of WhatsApp config', () => {
    expect(() => assertOtpFallbackNotReachableInProduction({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertOtpFallbackNotReachableInProduction({})).not.toThrow();
  });

  it('allows boot in production when WhatsApp is fully configured', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({
        NODE_ENV: 'production',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'id',
      }),
    ).not.toThrow();
  });

  it('refuses to boot in production when WhatsApp is not configured', () => {
    expect(() => assertOtpFallbackNotReachableInProduction({ NODE_ENV: 'production' })).toThrow(/refusing to start/);
  });

  it('refuses to boot in production when only one WhatsApp var is set', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({ NODE_ENV: 'production', WHATSAPP_ACCESS_TOKEN: 'token' }),
    ).toThrow(/refusing to start/);
  });

  it('allows the explicit override even without WhatsApp configured', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({ NODE_ENV: 'production', ALLOW_OTP_FALLBACK_IN_PRODUCTION: 'true' }),
    ).not.toThrow();
  });

  // NOT-013 — Wasender is a first-class transport, so it must satisfy the
  // guard on its own. Before this, switching provider would have tripped the
  // boot guard (or, off production, silently enabled the fallback code).
  it('allows boot in production on Wasender alone', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({
        NODE_ENV: 'production',
        WHATSAPP_PROVIDER: 'wasender',
        WASENDER_API_KEY: 'wsk_real',
      }),
    ).not.toThrow();
  });

  // The regression that made this guard inert in production: "..." is a
  // non-empty string, so the old truthiness check passed while no working
  // transport existed.
  it('refuses to boot when the WhatsApp vars are placeholder values', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({
        NODE_ENV: 'production',
        WHATSAPP_ACCESS_TOKEN: '...',
        WHATSAPP_PHONE_NUMBER_ID: '...',
      }),
    ).toThrow(/refusing to start/);
  });

  it('refuses to boot when switched to wasender without its key', () => {
    expect(() =>
      assertOtpFallbackNotReachableInProduction({
        NODE_ENV: 'production',
        WHATSAPP_PROVIDER: 'wasender',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'id',
      }),
    ).toThrow(/refusing to start/);
  });
});
