import { ActivePackage, coversTest, mergeEntitlements, NO_ENTITLEMENTS } from './entitlements.util';

const qudurat: ActivePackage = {
  testIds: ['qudurat'],
  questionsPerDay: 5,
  dailyWathbLimit: 1,
  simulationsIncluded: 2,
  weeklyReportEnabled: true,
  supervisorLinkingAllowed: true,
  dailyNotificationEnabled: true,
  reportVisibility: 'full',
};

/** A second package from a different catalogue group, deliberately meaner. */
const english: ActivePackage = {
  testIds: ['step'],
  questionsPerDay: 10,
  dailyWathbLimit: 3,
  simulationsIncluded: 1,
  weeklyReportEnabled: false,
  supervisorLinkingAllowed: false,
  dailyNotificationEnabled: false,
  reportVisibility: 'partial',
};

describe('mergeEntitlements with no subscriptions', () => {
  it('grants nothing and says so', () => {
    expect(mergeEntitlements([])).toEqual(NO_ENTITLEMENTS);
    expect(mergeEntitlements([]).none).toBe(true);
  });
});

describe('mergeEntitlements with one subscription', () => {
  it('passes the package through unchanged', () => {
    const e = mergeEntitlements([qudurat]);
    expect(e.none).toBe(false);
    expect(e.coveredTestIds).toEqual(['qudurat']);
    expect(e.questionsPerDay).toBe(5);
    expect(e.dailyWathbLimit).toBe(1);
    expect(e.simulationsIncluded).toBe(2);
    expect(e.reportVisibility).toBe('full');
  });
});

describe('mergeEntitlements across catalogue groups', () => {
  it('covers every test from every active subscription', () => {
    // The requirement this file exists for: a student preparing for قدرات who
    // adds an English test keeps both, rather than the newer purchase
    // replacing the older one's coverage.
    expect(mergeEntitlements([qudurat, english]).coveredTestIds.sort()).toEqual(['qudurat', 'step']);
  });

  it('does not lose coverage when the order is reversed', () => {
    expect(mergeEntitlements([english, qudurat]).coveredTestIds.sort()).toEqual(['qudurat', 'step']);
  });

  it('de-duplicates a test both packages carry', () => {
    const overlap = { ...english, testIds: ['step', 'qudurat'] };
    expect(mergeEntitlements([qudurat, overlap]).coveredTestIds.sort()).toEqual(['qudurat', 'step']);
  });

  it('takes the highest daily question count', () => {
    expect(mergeEntitlements([qudurat, english]).questionsPerDay).toBe(10);
  });

  it('sums simulation attempts rather than taking the larger', () => {
    // Consumable units, not a tier flag. Taking the max would silently void
    // half of what the student paid for.
    expect(mergeEntitlements([qudurat, english]).simulationsIncluded).toBe(3);
  });

  it('lets an uncapped package beat any numeric cap', () => {
    const uncapped = { ...english, dailyWathbLimit: null };
    expect(mergeEntitlements([qudurat, uncapped]).dailyWathbLimit).toBeNull();
    // And in the other order, since null loses every naive numeric comparison.
    expect(mergeEntitlements([uncapped, qudurat]).dailyWathbLimit).toBeNull();
  });

  it('takes the highest cap when neither is uncapped', () => {
    expect(mergeEntitlements([qudurat, english]).dailyWathbLimit).toBe(3);
  });

  it('turns a feature on if any active package grants it', () => {
    // A student who paid for two things must never get less than either one
    // bought alone.
    const e = mergeEntitlements([qudurat, english]);
    expect(e.weeklyReportEnabled).toBe(true);
    expect(e.supervisorLinkingAllowed).toBe(true);
    expect(e.dailyNotificationEnabled).toBe(true);
  });

  it('leaves a feature off only when no package grants it', () => {
    const e = mergeEntitlements([english, { ...english, testIds: ['other'] }]);
    expect(e.weeklyReportEnabled).toBe(false);
    expect(e.supervisorLinkingAllowed).toBe(false);
  });

  it('grants the full report if any package does', () => {
    expect(mergeEntitlements([english, qudurat]).reportVisibility).toBe('full');
    expect(mergeEntitlements([english]).reportVisibility).toBe('partial');
  });
});

describe('robustness against partial package rows', () => {
  it('survives a package with no testIds', () => {
    const broken = { ...english, testIds: undefined as unknown as string[] };
    expect(mergeEntitlements([broken]).coveredTestIds).toEqual([]);
  });

  it('treats missing numeric fields as zero rather than NaN', () => {
    const broken = { ...english, questionsPerDay: undefined as unknown as number, simulationsIncluded: undefined as unknown as number };
    const e = mergeEntitlements([broken]);
    expect(e.questionsPerDay).toBe(0);
    expect(e.simulationsIncluded).toBe(0);
  });
});

describe('coversTest', () => {
  it('is true for any test in any active package', () => {
    const e = mergeEntitlements([qudurat, english]);
    expect(coversTest(e, 'qudurat')).toBe(true);
    expect(coversTest(e, 'step')).toBe(true);
    expect(coversTest(e, 'tahsili')).toBe(false);
  });

  it('is false for everything with no subscription', () => {
    expect(coversTest(NO_ENTITLEMENTS, 'qudurat')).toBe(false);
  });
});
