// Pure logic, unit-testable independent of the DB — same discipline as the
// selection engine and reactive scheduler.

export interface SubscriptionLike {
  status: string;
  endsAt: Date | null;
  package: { testIds: string[] };
}

/** Does this subscription currently grant access to the given test? */
export function isSubscriptionCovering(sub: SubscriptionLike, testId: string, now: Date = new Date()): boolean {
  if (sub.status !== 'active') return false;
  if (sub.endsAt && sub.endsAt < now) return false;
  return sub.package.testIds.includes(testId);
}

export function anyActiveCovers(subs: SubscriptionLike[], testId: string, now: Date = new Date()): boolean {
  return subs.some((s) => isSubscriptionCovering(s, testId, now));
}

const VAT_RATE = 0.15; // KSA — spec §4.5

/** priceHalalas is stored VAT-inclusive; this splits it out for display only. */
export function vatBreakdown(priceHalalasInclusive: number) {
  const base = Math.round(priceHalalasInclusive / (1 + VAT_RATE));
  return { baseHalalas: base, vatHalalas: priceHalalasInclusive - base, totalHalalas: priceHalalasInclusive };
}
