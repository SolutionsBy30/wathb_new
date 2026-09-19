/**
 * PAY-013 — what a student is entitled to, across every active subscription.
 *
 * A student preparing for قدرات who later adds an English proficiency test
 * holds two subscriptions at once. Almost every consumer of this used to read
 * a single `findFirst({ status: 'active' })` and decide from that package
 * alone, which meant the newest purchase silently replaced the older one's
 * entitlements: buy a second package and the first one's tests stop being
 * covered.
 *
 * The merge rule is "most permissive wins", chosen because the alternative is
 * indefensible — a student who has paid for two things should never get less
 * than either one bought alone. Concretely:
 *
 *  - covered tests: the union. This is the whole point.
 *  - questionsPerDay, dailyWathbLimit: the maximum, with null (uncapped)
 *    beating every number.
 *  - simulationsIncluded: the sum. These are consumable units, not a tier
 *    flag — two packages of two attempts each is four attempts, and taking
 *    the max would quietly void half of what was paid for.
 *  - every feature flag: OR.
 *  - reportVisibility: 'full' if any package grants it.
 *
 * Pure, so the rule is tested rather than inferred from six call sites.
 */

export interface ActivePackage {
  testIds: string[];
  questionsPerDay: number;
  dailyWathbLimit: number | null;
  simulationsIncluded: number;
  weeklyReportEnabled: boolean;
  supervisorLinkingAllowed: boolean;
  dailyNotificationEnabled: boolean;
  reportVisibility: string;
}

export interface Entitlements {
  /** True when the student holds no active subscription at all. */
  none: boolean;
  coveredTestIds: string[];
  questionsPerDay: number;
  /** null means uncapped. */
  dailyWathbLimit: number | null;
  simulationsIncluded: number;
  weeklyReportEnabled: boolean;
  supervisorLinkingAllowed: boolean;
  dailyNotificationEnabled: boolean;
  reportVisibility: 'full' | 'partial';
}

export const NO_ENTITLEMENTS: Entitlements = {
  none: true,
  coveredTestIds: [],
  questionsPerDay: 0,
  dailyWathbLimit: 0,
  simulationsIncluded: 0,
  weeklyReportEnabled: false,
  supervisorLinkingAllowed: false,
  dailyNotificationEnabled: false,
  reportVisibility: 'partial',
};

export function mergeEntitlements(packages: ActivePackage[]): Entitlements {
  if (packages.length === 0) return NO_ENTITLEMENTS;

  const coveredTestIds = [...new Set(packages.flatMap((p) => p.testIds ?? []))];

  // null is "uncapped" and therefore the most permissive value there is, so it
  // wins outright rather than losing to a numeric comparison against null.
  const anyUncapped = packages.some((p) => p.dailyWathbLimit == null);
  const dailyWathbLimit = anyUncapped
    ? null
    : Math.max(...packages.map((p) => p.dailyWathbLimit ?? 0));

  return {
    none: false,
    coveredTestIds,
    questionsPerDay: Math.max(...packages.map((p) => p.questionsPerDay ?? 0)),
    dailyWathbLimit,
    // Summed, not maxed: these are consumable attempts, and a student who
    // bought two packages paid for both allowances.
    simulationsIncluded: packages.reduce((n, p) => n + (p.simulationsIncluded ?? 0), 0),
    weeklyReportEnabled: packages.some((p) => p.weeklyReportEnabled),
    supervisorLinkingAllowed: packages.some((p) => p.supervisorLinkingAllowed),
    dailyNotificationEnabled: packages.some((p) => p.dailyNotificationEnabled),
    reportVisibility: packages.some((p) => p.reportVisibility === 'full') ? 'full' : 'partial',
  };
}

/** Does any active subscription cover this test? */
export function coversTest(entitlements: Entitlements, testId: string): boolean {
  return entitlements.coveredTestIds.includes(testId);
}
