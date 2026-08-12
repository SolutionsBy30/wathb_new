import { isPlaceholder, isWhatsAppConfigured, resolveWhatsAppProvider } from './whatsapp-provider.util';

const META = { WHATSAPP_ACCESS_TOKEN: 'EAAreal', WHATSAPP_PHONE_NUMBER_ID: '1419270713379364' };
const WASENDER = { WASENDER_API_KEY: 'wsk_real' };

describe('isPlaceholder', () => {
  it('treats empty and whitespace as unset', () => {
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('   ')).toBe(true);
  });

  // This is the exact production incident: WHATSAPP_ACCESS_TOKEN was the
  // literal "...", which is truthy, so the API believed WhatsApp was
  // configured and POSTed "..." to Meta as a phone number id for days.
  it('treats dot-runs and common placeholder words as unset', () => {
    expect(isPlaceholder('...')).toBe(true);
    expect(isPlaceholder('.')).toBe(true);
    expect(isPlaceholder('changeme')).toBe(true);
    expect(isPlaceholder('your-mailbox-password')).toBe(true);
    expect(isPlaceholder('XXXX')).toBe(true);
  });

  it('accepts real-looking values', () => {
    expect(isPlaceholder('EAAreal')).toBe(false);
    expect(isPlaceholder('1419270713379364')).toBe(false);
  });
});

describe('resolveWhatsAppProvider', () => {
  it('defaults to meta when meta creds are real and no switch is set', () => {
    expect(resolveWhatsAppProvider({ ...META } as any)).toBe('meta');
  });

  it('defaults to none when meta creds are placeholders', () => {
    expect(resolveWhatsAppProvider({ WHATSAPP_ACCESS_TOKEN: '...', WHATSAPP_PHONE_NUMBER_ID: '141927' } as any)).toBe('none');
  });

  it('selects wasender when explicitly switched, even with meta creds present', () => {
    expect(resolveWhatsAppProvider({ ...META, ...WASENDER, WHATSAPP_PROVIDER: 'wasender' } as any)).toBe('wasender');
  });

  it('switches back to meta on demand without removing wasender config', () => {
    expect(resolveWhatsAppProvider({ ...META, ...WASENDER, WHATSAPP_PROVIDER: 'meta' } as any)).toBe('meta');
  });

  it('honours an explicit none', () => {
    expect(resolveWhatsAppProvider({ ...META, ...WASENDER, WHATSAPP_PROVIDER: 'none' } as any)).toBe('none');
  });

  // A named provider with missing credentials must NOT silently fall through
  // to the other one — that would route production traffic somewhere the
  // operator did not choose.
  it('resolves to none when the named provider is not configured', () => {
    expect(resolveWhatsAppProvider({ ...META, WHATSAPP_PROVIDER: 'wasender' } as any)).toBe('none');
    expect(resolveWhatsAppProvider({ ...WASENDER, WHATSAPP_PROVIDER: 'meta' } as any)).toBe('none');
  });

  it('is case- and whitespace-insensitive on the switch', () => {
    expect(resolveWhatsAppProvider({ ...WASENDER, WHATSAPP_PROVIDER: ' WaSender ' } as any)).toBe('wasender');
  });
});

describe('isWhatsAppConfigured', () => {
  // The security-critical property: when this is false, otp.service.ts issues
  // the fixed public fallback code to every login. Switching provider must
  // never make it false by accident.
  it('is true under wasender and stays true after switching to meta', () => {
    expect(isWhatsAppConfigured({ ...WASENDER, WHATSAPP_PROVIDER: 'wasender' } as any)).toBe(true);
    expect(isWhatsAppConfigured({ ...META, WHATSAPP_PROVIDER: 'meta' } as any)).toBe(true);
  });

  it('is false when nothing real is configured', () => {
    expect(isWhatsAppConfigured({} as any)).toBe(false);
    expect(isWhatsAppConfigured({ WHATSAPP_ACCESS_TOKEN: '...', WHATSAPP_PHONE_NUMBER_ID: '...' } as any)).toBe(false);
  });
});
