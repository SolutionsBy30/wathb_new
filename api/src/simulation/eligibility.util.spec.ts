import { GateConfig, StudentGateFacts, describeBlocks, evaluateEligibility } from './eligibility.util';

const CONFIG: GateConfig = {
  minCompletedLeaps: 20,
  minAnsweredQuestions: 100,
  minCoverageAreas: false,
  minDaysBetweenAttempts: 7,
  minLeapsBetweenAttempts: 7,
  requirePlacement: true,
  totalAreas: 10,
};

const READY: StudentGateFacts = {
  completedLeaps: 20,
  answeredQuestions: 100,
  areasCovered: 10,
  placementDoneAt: new Date('2026-01-01'),
  lastAttemptFinalizedAt: null,
  leapsSinceLastAttempt: 0,
  hasUnusedOverride: false,
};

const NOW = new Date('2026-03-01T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

describe('Gate A — practice threshold', () => {
  it('lets a student through who meets every requirement', () => {
    expect(evaluateEligibility(READY, CONFIG, NOW).eligible).toBe(true);
  });

  it('blocks below the leap threshold', () => {
    const r = evaluateEligibility({ ...READY, completedLeaps: 12 }, CONFIG, NOW);
    expect(r.eligible).toBe(false);
    expect(r.blockedReasons).toContain('not_enough_leaps');
  });

  it('blocks below the answered-question threshold even with enough leaps', () => {
    // Short bundles could clear 20 leaps on far fewer than 100 questions.
    const r = evaluateEligibility({ ...READY, answeredQuestions: 60 }, CONFIG, NOW);
    expect(r.blockedReasons).toContain('not_enough_questions');
  });

  it('requires the placement Wathb when the blueprint says so', () => {
    const r = evaluateEligibility({ ...READY, placementDoneAt: null }, CONFIG, NOW);
    expect(r.blockedReasons).toContain('placement_required');
  });

  it('ignores placement when the blueprint does not require it', () => {
    const r = evaluateEligibility({ ...READY, placementDoneAt: null }, { ...CONFIG, requirePlacement: false }, NOW);
    expect(r.eligible).toBe(true);
  });

  it('enforces area coverage only when enabled', () => {
    const facts = { ...READY, areasCovered: 6 };
    expect(evaluateEligibility(facts, CONFIG, NOW).eligible).toBe(true);
    const strict = evaluateEligibility(facts, { ...CONFIG, minCoverageAreas: true }, NOW);
    expect(strict.blockedReasons).toContain('not_enough_area_coverage');
  });

  it('reports every unmet condition, not just the first', () => {
    const r = evaluateEligibility(
      { ...READY, completedLeaps: 1, answeredQuestions: 5, placementDoneAt: null },
      CONFIG,
      NOW,
    );
    expect(r.blockedReasons).toEqual(
      expect.arrayContaining(['placement_required', 'not_enough_leaps', 'not_enough_questions']),
    );
  });
});

describe('Gate B — cooldown', () => {
  it('blocks within the cooldown window', () => {
    const r = evaluateEligibility(
      { ...READY, lastAttemptFinalizedAt: daysAgo(3), leapsSinceLastAttempt: 3 },
      CONFIG,
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.blockedReasons).toContain('cooldown_days');
  });

  it('measures from finalizedAt, so the window ends exactly 7 days later', () => {
    const r = evaluateEligibility(
      { ...READY, lastAttemptFinalizedAt: daysAgo(7), leapsSinceLastAttempt: 7 },
      CONFIG,
      NOW,
    );
    expect(r.eligible).toBe(true);
  });

  it('still blocks after 7 days when the leaps between attempts are missing', () => {
    // The cooldown is meant to be filled with the post-simulation plan, not
    // with idle waiting.
    const r = evaluateEligibility(
      { ...READY, lastAttemptFinalizedAt: daysAgo(10), leapsSinceLastAttempt: 2 },
      CONFIG,
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.blockedReasons).toContain('cooldown_leaps');
  });

  it('applies the cooldown to an abandoned attempt — abandonment is not a free reset', () => {
    // The caller passes finalizedAt for abandoned/expired attempts too, so
    // rage-quitting to fish for an easier form still costs the full week.
    const r = evaluateEligibility(
      { ...READY, lastAttemptFinalizedAt: daysAgo(1), leapsSinceLastAttempt: 0 },
      CONFIG,
      NOW,
    );
    expect(r.eligible).toBe(false);
  });

  it('reports the unlock date', () => {
    const r = evaluateEligibility({ ...READY, lastAttemptFinalizedAt: daysAgo(2) }, CONFIG, NOW);
    expect(r.nextEligibleAt).toEqual(new Date(daysAgo(2).getTime() + 7 * 86400000));
  });

  it('applies no cooldown to a first attempt', () => {
    const r = evaluateEligibility(READY, CONFIG, NOW);
    expect(r.nextEligibleAt).toBeNull();
    expect(r.progress.requiredLeapsBetween).toBe(0);
  });
});

describe('admin override', () => {
  it('clears the gates but is reported as an override', () => {
    const r = evaluateEligibility({ ...READY, completedLeaps: 0, hasUnusedOverride: true }, CONFIG, NOW);
    expect(r.eligible).toBe(true);
    expect(r.viaOverride).toBe(true);
    expect(r.blockedReasons).toEqual([]);
  });

  it('is not marked as an override when the student qualified anyway', () => {
    const r = evaluateEligibility({ ...READY, hasUnusedOverride: true }, CONFIG, NOW);
    expect(r.eligible).toBe(true);
    expect(r.viaOverride).toBe(false);
  });
});

describe('locked-state messages', () => {
  it('shows progress rather than a bare lock', () => {
    const r = evaluateEligibility({ ...READY, completedLeaps: 12 }, CONFIG, NOW);
    const messages = describeBlocks(r);
    expect(messages.join(' ')).toContain('١٢'.length ? '12' : '12'); // digits are latin in the template
    expect(messages.join(' ')).toContain('20');
    expect(messages.join(' ')).toContain('وثبة');
  });

  it('names the unlock date for a cooldown block', () => {
    const r = evaluateEligibility({ ...READY, lastAttemptFinalizedAt: daysAgo(2) }, CONFIG, NOW);
    expect(describeBlocks(r).join(' ')).toContain('المحاكي التالي متاح');
  });
});
