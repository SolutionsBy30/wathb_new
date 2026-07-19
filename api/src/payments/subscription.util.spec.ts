import { anyActiveCovers, isSubscriptionCovering, vatBreakdown } from './subscription.util';

const NOW = new Date('2026-07-19T00:00:00Z');

function sub(overrides: Partial<{ status: string; endsAt: Date | null; testIds: string[] }> = {}) {
  return {
    status: overrides.status ?? 'active',
    endsAt: overrides.endsAt === undefined ? new Date('2026-12-31T00:00:00Z') : overrides.endsAt,
    package: { testIds: overrides.testIds ?? ['qudurat'] },
  };
}

describe('isSubscriptionCovering', () => {
  it('covers an active, unexpired subscription for the right test', () => {
    expect(isSubscriptionCovering(sub(), 'qudurat', NOW)).toBe(true);
  });

  it('rejects a non-active subscription', () => {
    expect(isSubscriptionCovering(sub({ status: 'pending' }), 'qudurat', NOW)).toBe(false);
    expect(isSubscriptionCovering(sub({ status: 'expired' }), 'qudurat', NOW)).toBe(false);
  });

  it('rejects a subscription past its endsAt', () => {
    expect(isSubscriptionCovering(sub({ endsAt: new Date('2026-01-01T00:00:00Z') }), 'qudurat', NOW)).toBe(false);
  });

  it('accepts a subscription with no endsAt yet (still pending activation window)', () => {
    expect(isSubscriptionCovering(sub({ endsAt: null }), 'qudurat', NOW)).toBe(true);
  });

  it('rejects when the package does not include the requested test', () => {
    expect(isSubscriptionCovering(sub({ testIds: ['tahsili'] }), 'qudurat', NOW)).toBe(false);
  });
});

describe('anyActiveCovers', () => {
  it('finds coverage across multiple subscriptions', () => {
    const subs = [sub({ testIds: ['tahsili'] }), sub({ testIds: ['qudurat'] })];
    expect(anyActiveCovers(subs, 'qudurat', NOW)).toBe(true);
    expect(anyActiveCovers(subs, 'other', NOW)).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(anyActiveCovers([], 'qudurat', NOW)).toBe(false);
  });
});

describe('vatBreakdown', () => {
  it('splits a VAT-inclusive price at the 15% KSA rate', () => {
    const b = vatBreakdown(11500); // 115.00 SAR inclusive
    expect(b.baseHalalas).toBe(10000);
    expect(b.vatHalalas).toBe(1500);
    expect(b.totalHalalas).toBe(11500);
  });
});
