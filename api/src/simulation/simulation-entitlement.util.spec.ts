import { mergeAllowances, NO_ENTITLEMENT, SubscriptionAllowance } from './simulation-entitlement.util';

const MARCH = new Date('2027-03-01T00:00:00Z');
const SEPTEMBER = new Date('2027-09-01T00:00:00Z');

const allowance = (over: Partial<SubscriptionAllowance> = {}): SubscriptionAllowance => ({
  subscriptionId: 'sub-a',
  packageNameAr: 'الشاملة',
  included: 2,
  used: 0,
  endsAt: SEPTEMBER,
  ...over,
});

describe('mergeAllowances with nothing active', () => {
  it('grants nothing and names no subscription to charge', () => {
    expect(mergeAllowances([])).toEqual(NO_ENTITLEMENT);
  });
});

describe('mergeAllowances with one subscription', () => {
  it('behaves exactly as the single-package path did', () => {
    const e = mergeAllowances([allowance({ included: 2, used: 1 })]);
    expect(e.included).toBe(2);
    expect(e.used).toBe(1);
    expect(e.remaining).toBe(1);
    expect(e.subscriptionId).toBe('sub-a');
    expect(e.packageNameAr).toBe('الشاملة');
  });

  it('charges nothing when the package includes no simulator', () => {
    // §5.5 — zero is the safe default and must not become a chargeable slot.
    const e = mergeAllowances([allowance({ included: 0 })]);
    expect(e.remaining).toBe(0);
    expect(e.subscriptionId).toBeNull();
  });
});

describe('mergeAllowances across packages', () => {
  const qudurat = allowance({ subscriptionId: 'sub-q', packageNameAr: 'قدرات', included: 2, used: 1, endsAt: SEPTEMBER });
  const licence = allowance({ subscriptionId: 'sub-l', packageNameAr: 'الترخيص', included: 4, used: 0, endsAt: MARCH });

  it('adds up what the learner actually paid for', () => {
    // The bug this file exists for: a learner holding both saw only the
    // newest package's allowance, and attempts charged to the other were
    // invisible to the counter.
    const e = mergeAllowances([qudurat, licence]);
    expect(e.included).toBe(6);
    expect(e.used).toBe(1);
    expect(e.remaining).toBe(5);
  });

  it('spends the allowance that expires first', () => {
    // Charging the September package first would let the March one lapse
    // unused. Someone who paid for both should lose neither.
    expect(mergeAllowances([qudurat, licence]).subscriptionId).toBe('sub-l');
    expect(mergeAllowances([licence, qudurat]).subscriptionId).toBe('sub-l');
  });

  it('names the package being spent, not the largest one', () => {
    expect(mergeAllowances([qudurat, licence]).packageNameAr).toBe('الترخيص');
  });

  it('skips an exhausted package when choosing what to charge', () => {
    const spent = { ...licence, used: 4 };
    const e = mergeAllowances([qudurat, spent]);
    expect(e.subscriptionId).toBe('sub-q');
    expect(e.remaining).toBe(1);
  });

  it('charges nothing once every package is exhausted', () => {
    const e = mergeAllowances([{ ...qudurat, used: 2 }, { ...licence, used: 4 }]);
    expect(e.remaining).toBe(0);
    expect(e.subscriptionId).toBeNull();
    // The totals still report the truth, so the learner sees 6 of 6 used
    // rather than an empty state that looks like they never had any.
    expect(e.included).toBe(6);
    expect(e.used).toBe(6);
  });

  it('reports every contributing package', () => {
    const e = mergeAllowances([qudurat, licence]);
    expect(e.sources).toHaveLength(2);
    expect(e.sources.map((s) => s.remaining).sort()).toEqual([1, 4]);
  });

  it('prefers a dated package over an open-ended one', () => {
    const openEnded = allowance({ subscriptionId: 'sub-open', endsAt: null, included: 3 });
    expect(mergeAllowances([openEnded, licence]).subscriptionId).toBe('sub-l');
  });

  it('is stable when two packages expire on the same day', () => {
    // Otherwise which one gets charged depends on query order, and the same
    // request answers differently on two runs.
    const a = allowance({ subscriptionId: 'sub-a', endsAt: MARCH });
    const b = allowance({ subscriptionId: 'sub-b', endsAt: MARCH });
    expect(mergeAllowances([a, b]).subscriptionId).toBe('sub-a');
    expect(mergeAllowances([b, a]).subscriptionId).toBe('sub-a');
  });
});

describe('robustness', () => {
  it('never reports a negative remaining when an admin lowers the allowance', () => {
    // Dropping simulationsIncluded below what someone already used must not
    // eat into another package's remaining attempts.
    const shrunk = allowance({ subscriptionId: 'sub-s', included: 1, used: 3 });
    const other = allowance({ subscriptionId: 'sub-o', included: 2, used: 0, endsAt: MARCH });
    const e = mergeAllowances([shrunk, other]);
    expect(e.remaining).toBe(2);
    expect(e.subscriptionId).toBe('sub-o');
  });

  it('reports used as it happened rather than clamping it', () => {
    const e = mergeAllowances([allowance({ included: 1, used: 3 })]);
    expect(e.used).toBe(3);
    expect(e.remaining).toBe(0);
  });
});
