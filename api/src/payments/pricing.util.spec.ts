import { applyPromoCode, DiscountCodeLike, packagePriceView } from './pricing.util';

const NOW = new Date('2026-08-17T12:00:00Z');

describe('packagePriceView', () => {
  it('reports the saving when the was-price is genuinely higher', () => {
    expect(packagePriceView({ priceHalalas: 15000, compareAtHalalas: 20000 })).toEqual({
      priceHalalas: 15000,
      compareAtHalalas: 20000,
      discountPercent: 25,
    });
  });

  it('shows nothing when no was-price is set', () => {
    expect(packagePriceView({ priceHalalas: 15000, compareAtHalalas: null }).compareAtHalalas).toBeNull();
  });

  // An admin who lowers the "was" price below the real one — or leaves it
  // equal — would otherwise publish "0% off" or a negative saving.
  it('ignores a was-price that is not strictly higher', () => {
    expect(packagePriceView({ priceHalalas: 15000, compareAtHalalas: 15000 }).discountPercent).toBeNull();
    expect(packagePriceView({ priceHalalas: 15000, compareAtHalalas: 9000 }).discountPercent).toBeNull();
  });
});

function code(overrides: Partial<DiscountCodeLike> = {}): DiscountCodeLike {
  return {
    id: 'd1',
    code: 'WATHB20',
    kind: 'percent',
    value: 20,
    packageIds: [],
    maxRedemptions: null,
    timesRedeemed: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('applyPromoCode', () => {
  it('takes a percentage off', () => {
    expect(applyPromoCode(code(), 'pkg1', 20000, NOW)).toEqual({ ok: true, discountHalalas: 4000, totalHalalas: 16000 });
  });

  it('takes a fixed amount off', () => {
    expect(applyPromoCode(code({ kind: 'fixed', value: 5000 }), 'pkg1', 20000, NOW)).toEqual({
      ok: true, discountHalalas: 5000, totalHalalas: 15000,
    });
  });

  // A code worth more than the package makes it free, never negative — the
  // gateway would reject a negative amount and a refund is not what was meant.
  it('clamps a fixed amount larger than the price', () => {
    expect(applyPromoCode(code({ kind: 'fixed', value: 99000 }), 'pkg1', 20000, NOW)).toEqual({
      ok: true, discountHalalas: 20000, totalHalalas: 0,
    });
  });

  it('rounds to whole halalas so the charge matches the display', () => {
    const r = applyPromoCode(code({ value: 33 }), 'pkg1', 9999, NOW);
    expect(r).toEqual({ ok: true, discountHalalas: 3300, totalHalalas: 6699 });
    expect(Number.isInteger((r as any).discountHalalas)).toBe(true);
  });

  describe('rejections carry a distinct reason', () => {
    it('unknown code', () => {
      expect(applyPromoCode(null, 'pkg1', 20000, NOW)).toEqual({ ok: false, reason: 'not_found' });
    });
    it('switched off', () => {
      expect(applyPromoCode(code({ isActive: false }), 'pkg1', 20000, NOW)).toEqual({ ok: false, reason: 'inactive' });
    });
    it('not started yet', () => {
      expect(applyPromoCode(code({ startsAt: new Date('2026-09-01T00:00:00Z') }), 'pkg1', 20000, NOW))
        .toEqual({ ok: false, reason: 'not_started' });
    });
    it('expired', () => {
      expect(applyPromoCode(code({ expiresAt: new Date('2026-08-01T00:00:00Z') }), 'pkg1', 20000, NOW))
        .toEqual({ ok: false, reason: 'expired' });
    });
    it('redemption limit reached', () => {
      expect(applyPromoCode(code({ maxRedemptions: 5, timesRedeemed: 5 }), 'pkg1', 20000, NOW))
        .toEqual({ ok: false, reason: 'exhausted' });
    });
    it('scoped to other packages', () => {
      expect(applyPromoCode(code({ packageIds: ['pkg2'] }), 'pkg1', 20000, NOW))
        .toEqual({ ok: false, reason: 'not_applicable' });
    });
  });

  it('accepts a code scoped to this package, and an empty scope means all', () => {
    expect(applyPromoCode(code({ packageIds: ['pkg1', 'pkg2'] }), 'pkg1', 20000, NOW).ok).toBe(true);
    expect(applyPromoCode(code({ packageIds: [] }), 'anything', 20000, NOW).ok).toBe(true);
  });

  it('treats the window edges as inclusive', () => {
    expect(applyPromoCode(code({ startsAt: NOW }), 'pkg1', 20000, NOW).ok).toBe(true);
    expect(applyPromoCode(code({ expiresAt: NOW }), 'pkg1', 20000, NOW).ok).toBe(true);
  });
});
