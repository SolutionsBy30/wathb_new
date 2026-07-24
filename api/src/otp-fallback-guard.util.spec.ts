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
});
