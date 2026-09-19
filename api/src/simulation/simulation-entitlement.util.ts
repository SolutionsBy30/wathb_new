/**
 * SIM-024 — how many simulations a learner has, across every package they hold.
 *
 * §5.5 counts attempts rather than decrementing a counter, and each attempt
 * records the subscription it was charged to. That design extends to several
 * packages without changing: count per subscription, then add up.
 *
 * What does need deciding is which subscription a new attempt draws from when
 * more than one has room. The rule is "spend what expires first": a licensing
 * package ending in March and a قدرات package ending in September both have
 * attempts left, and charging the September one first would let the March
 * allowance lapse unused. A learner who paid for both should lose neither.
 *
 * Pure, because the alternative — reading it out of the service — is how the
 * single-subscription assumption survived PAY-013 in the first place.
 */

export interface SubscriptionAllowance {
  subscriptionId: string;
  packageNameAr: string;
  /** What this package includes per period. Zero means no simulator. */
  included: number;
  /** Attempts already charged to this subscription. */
  used: number;
  /** When it lapses; null means open-ended. */
  endsAt: Date | null;
}

export interface EntitlementSource {
  subscriptionId: string;
  packageNameAr: string;
  included: number;
  used: number;
  remaining: number;
}

export interface MergedEntitlement {
  /** The subscription a new attempt would be charged to, or null if none has room. */
  subscriptionId: string | null;
  /** The package behind that subscription — what the learner is told they are spending. */
  packageNameAr: string | null;
  included: number;
  used: number;
  remaining: number;
  /** Every contributing package, so a learner with two can see both. */
  sources: EntitlementSource[];
}

export const NO_ENTITLEMENT: MergedEntitlement = {
  subscriptionId: null,
  packageNameAr: null,
  included: 0,
  used: 0,
  remaining: 0,
  sources: [],
};

function remainingOf(a: SubscriptionAllowance): number {
  // Never negative: an admin lowering simulationsIncluded below what someone
  // has already used must not make other packages' allowances disappear into
  // a negative total.
  return Math.max(0, (a.included ?? 0) - (a.used ?? 0));
}

/**
 * Order for spending: soonest expiry first, open-ended last, and a stable
 * tie-break on id so two subscriptions expiring the same day always charge in
 * the same order rather than depending on query order.
 */
function spendOrder(a: SubscriptionAllowance, b: SubscriptionAllowance): number {
  if (a.endsAt && b.endsAt) {
    const d = a.endsAt.getTime() - b.endsAt.getTime();
    if (d !== 0) return d;
  } else if (a.endsAt && !b.endsAt) {
    return -1;
  } else if (!a.endsAt && b.endsAt) {
    return 1;
  }
  return a.subscriptionId.localeCompare(b.subscriptionId);
}

export function mergeAllowances(allowances: SubscriptionAllowance[]): MergedEntitlement {
  if (allowances.length === 0) return NO_ENTITLEMENT;

  const sources: EntitlementSource[] = allowances.map((a) => ({
    subscriptionId: a.subscriptionId,
    packageNameAr: a.packageNameAr,
    included: a.included ?? 0,
    used: a.used ?? 0,
    remaining: remainingOf(a),
  }));

  // The one to charge: soonest to lapse among those with room left. A package
  // that includes no simulator at all never gets charged, even if it is the
  // newest thing the learner bought.
  const chargeable = [...allowances].filter((a) => remainingOf(a) > 0).sort(spendOrder);
  const charge = chargeable[0] ?? null;

  return {
    subscriptionId: charge?.subscriptionId ?? null,
    packageNameAr: charge?.packageNameAr ?? null,
    included: sources.reduce((n, s) => n + s.included, 0),
    // Used is summed raw, not clamped: it is a record of what happened, and a
    // learner who used four attempts under a package later reduced to two
    // should still see four.
    used: sources.reduce((n, s) => n + s.used, 0),
    remaining: sources.reduce((n, s) => n + s.remaining, 0),
    sources,
  };
}
