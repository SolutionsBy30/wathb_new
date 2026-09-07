/**
 * SIM-002 — §5.6 eligibility gates, as a pure function.
 *
 * A simulation is a scarce, expensive, high-signal event: worthless as a
 * diagnostic if the student has no practice history, and worthless as a
 * progress measure if taken back to back. Both gates are therefore hard, and
 * both are evaluated server-side at start — client state is display only.
 *
 * Pure and separately tested because the failure modes are silent. A gate that
 * is wrong by one day, or that counts partial Wathbat, does not throw: it just
 * lets someone in who should have waited, or blocks someone who paid. Neither
 * is visible from a log.
 */

export interface GateConfig {
  minCompletedLeaps: number;
  minAnsweredQuestions: number;
  minCoverageAreas: boolean;
  minDaysBetweenAttempts: number;
  minLeapsBetweenAttempts: number;
  requirePlacement: boolean;
  /** How many distinct areas the blueprint covers, for minCoverageAreas. */
  totalAreas: number;
}

export interface StudentGateFacts {
  /** Wathbat where every question was answered. Partials do not accrue (§5.6). */
  completedLeaps: number;
  answeredQuestions: number;
  areasCovered: number;
  placementDoneAt: Date | null;
  /**
   * finalizedAt of the most recent attempt in ANY terminal state — completed,
   * expired or abandoned. Abandonment is not a free reset.
   */
  lastAttemptFinalizedAt: Date | null;
  /** Completed Wathbat since that attempt was finalized. */
  leapsSinceLastAttempt: number;
  /** An unused admin exemption (§5.6). */
  hasUnusedOverride: boolean;
}

export type BlockReason =
  | 'placement_required'
  | 'not_enough_leaps'
  | 'not_enough_questions'
  | 'not_enough_area_coverage'
  | 'cooldown_days'
  | 'cooldown_leaps';

export interface EligibilityResult {
  eligible: boolean;
  /** Every unmet condition, not just the first — the locked screen shows progress. */
  blockedReasons: BlockReason[];
  progress: {
    completedLeaps: number;
    requiredLeaps: number;
    answeredQuestions: number;
    requiredQuestions: number;
    areasCovered: number;
    requiredAreas: number;
    leapsSinceLastAttempt: number;
    requiredLeapsBetween: number;
  };
  /** When the cooldown lifts, or null when no cooldown applies. */
  nextEligibleAt: Date | null;
  /** True when the only thing letting them through is an admin exemption. */
  viaOverride: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateEligibility(
  facts: StudentGateFacts,
  config: GateConfig,
  now: Date = new Date(),
): EligibilityResult {
  const blockedReasons: BlockReason[] = [];

  // Gate A — practice threshold.
  if (config.requirePlacement && !facts.placementDoneAt) blockedReasons.push('placement_required');
  if (facts.completedLeaps < config.minCompletedLeaps) blockedReasons.push('not_enough_leaps');
  if (facts.answeredQuestions < config.minAnsweredQuestions) blockedReasons.push('not_enough_questions');
  if (config.minCoverageAreas && facts.areasCovered < config.totalAreas) {
    blockedReasons.push('not_enough_area_coverage');
  }

  // Gate B — cooldown. Measured from finalizedAt, not startedAt: a student who
  // sat for an hour has not had a week's gap just because they started one.
  let nextEligibleAt: Date | null = null;
  if (facts.lastAttemptFinalizedAt) {
    nextEligibleAt = new Date(facts.lastAttemptFinalizedAt.getTime() + config.minDaysBetweenAttempts * DAY_MS);
    if (now < nextEligibleAt) blockedReasons.push('cooldown_days');
    if (facts.leapsSinceLastAttempt < config.minLeapsBetweenAttempts) blockedReasons.push('cooldown_leaps');
  }

  // An exemption clears the gates but is still reported as such, so a report
  // reader can tell a normally-earned attempt from a granted one.
  const viaOverride = blockedReasons.length > 0 && facts.hasUnusedOverride;

  return {
    eligible: blockedReasons.length === 0 || viaOverride,
    blockedReasons: viaOverride ? [] : blockedReasons,
    progress: {
      completedLeaps: facts.completedLeaps,
      requiredLeaps: config.minCompletedLeaps,
      answeredQuestions: facts.answeredQuestions,
      requiredQuestions: config.minAnsweredQuestions,
      areasCovered: facts.areasCovered,
      requiredAreas: config.minCoverageAreas ? config.totalAreas : 0,
      leapsSinceLastAttempt: facts.leapsSinceLastAttempt,
      requiredLeapsBetween: facts.lastAttemptFinalizedAt ? config.minLeapsBetweenAttempts : 0,
    },
    nextEligibleAt,
    viaOverride,
  };
}

/** §5.6 — progress, never a bare "مقفل". */
export const BLOCK_REASON_AR: Record<BlockReason, (p: EligibilityResult['progress'], at: Date | null) => string> = {
  placement_required: () => 'أكمل وثبة تحديد المستوى أولاً.',
  not_enough_leaps: (p) =>
    `أكملت ${p.completedLeaps} من ${p.requiredLeaps} وثبة — تبقّى ${Math.max(0, p.requiredLeaps - p.completedLeaps)} وثبات لفتح المحاكي.`,
  not_enough_questions: (p) =>
    `أجبت عن ${p.answeredQuestions} من ${p.requiredQuestions} سؤالاً المطلوبة قبل المحاكي.`,
  not_enough_area_coverage: (p) =>
    `تدرّبت على ${p.areasCovered} من ${p.requiredAreas} مجالات — جرّب المجالات المتبقية قبل المحاكي.`,
  cooldown_days: (_p, at) =>
    `المحاكي التالي متاح في ${at ? at.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}.`,
  cooldown_leaps: (p) =>
    `أكمل ${Math.max(0, p.requiredLeapsBetween - p.leapsSinceLastAttempt)} وثبات إضافية قبل المحاكي التالي.`,
};

export function describeBlocks(result: EligibilityResult): string[] {
  return result.blockedReasons.map((r) => BLOCK_REASON_AR[r](result.progress, result.nextEligibleAt));
}
