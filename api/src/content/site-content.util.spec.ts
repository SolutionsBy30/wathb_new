import { isKnownKey, SITE_CONTENT_KEYS, withDefaults } from './site-content.util';

describe('SITE_CONTENT_KEYS', () => {
  it('has no duplicate keys', () => {
    // A duplicate silently makes one entry unreachable in the editor while
    // still looking present in the list.
    const keys = SITE_CONTENT_KEYS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every key a non-empty default', () => {
    // The default is what keeps the public page whole between deploying a key
    // and seeding its value.
    for (const d of SITE_CONTENT_KEYS) {
      expect({ key: d.key, ok: d.defaultAr.trim().length > 0 }).toEqual({ key: d.key, ok: true });
    }
  });

  it('gives every key a label an admin can read', () => {
    for (const d of SITE_CONTENT_KEYS) {
      expect({ key: d.key, ok: d.labelAr.trim().length > 0 }).toEqual({ key: d.key, ok: true });
    }
  });

  it('files every key under a known section', () => {
    const sections = new Set(['hero', 'features', 'groups', 'pricing', 'footer']);
    for (const d of SITE_CONTENT_KEYS) {
      expect({ key: d.key, ok: sections.has(d.section) }).toEqual({ key: d.key, ok: true });
    }
  });
});

describe('isKnownKey', () => {
  it('accepts a declared key and refuses anything else', () => {
    // The write path checks this, so an arbitrary key cannot be stored and
    // then never rendered — a row nobody can find or clean up.
    expect(isKnownKey('hero.headline')).toBe(true);
    expect(isKnownKey('hero.nonsense')).toBe(false);
    expect(isKnownKey('')).toBe(false);
  });
});

describe('withDefaults', () => {
  it('prefers a stored value', () => {
    const out = withDefaults([{ key: 'hero.headline', valueAr: 'عنوان جديد' }]);
    expect(out['hero.headline']).toBe('عنوان جديد');
  });

  it('falls back for a key with nothing stored', () => {
    const out = withDefaults([]);
    expect(out['hero.headline']).toBe('كل يوم وثبة. وثبة واحدة في النهاية.');
  });

  it('falls back when a value was cleared to empty or whitespace', () => {
    // Clearing a field is far likelier to be an accident than a request for a
    // blank headline, and an empty hero reads as broken rather than minimal.
    expect(withDefaults([{ key: 'hero.badge', valueAr: '' }])['hero.badge']).toBeTruthy();
    expect(withDefaults([{ key: 'hero.badge', valueAr: '   ' }])['hero.badge']).toBeTruthy();
  });

  it('returns every declared key, whatever was stored', () => {
    // The client indexes into this object directly, so a missing key would
    // render as "undefined" on the public page.
    const out = withDefaults([{ key: 'hero.headline', valueAr: 'x' }]);
    for (const d of SITE_CONTENT_KEYS) expect(typeof out[d.key]).toBe('string');
  });

  it('ignores a stored key that is no longer declared', () => {
    // A key removed from the code leaves its row behind; it must not leak
    // into the payload the page reads.
    const out = withDefaults([{ key: 'retired.key', valueAr: 'old' }]);
    expect(out['retired.key']).toBeUndefined();
  });
});
