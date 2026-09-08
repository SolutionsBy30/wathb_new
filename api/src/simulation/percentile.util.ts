/**
 * SIM-015 — §7.2 cohort percentile, as a pure function.
 *
 * "Comparison … vs school cohort; vs national platform cohort (percentile),
 * **only for static forms**." The restriction is the whole point: a dynamic
 * form is assembled for one student, so a percentile against people who sat
 * different questions compares nothing.
 */

/**
 * Below this, a percentile is arithmetic without meaning.
 *
 * With five peers, "أنت في المئين ٨٠" means four people — and it moves twenty
 * points when one more person sits the form. A student planning a قياس sitting
 * would read that as a stable position. The number is withheld until the
 * cohort can carry it, and the UI says so rather than showing a placeholder.
 *
 * Deliberately higher than the sample floor used for per-question statistics:
 * a p-value guides an admin's item review, a percentile is shown to a
 * seventeen-year-old as a statement about where they stand.
 */
export const MIN_COHORT_FOR_PERCENTILE = 20;

export interface PercentileResult {
  /** 0..100, rounded to one decimal. Null when the cohort is too small. */
  percentile: number | null;
  cohortSize: number;
  /** Why it is null, so the screen can say the honest thing. */
  reason: 'ok' | 'cohort_too_small' | 'not_comparable';
}

/**
 * Mid-rank percentile: everyone strictly below, plus half of those equal.
 *
 * Half-credit for ties is what stops two students with identical scores
 * getting different standings, and stops a modal score reading as either 0th
 * or 100th percentile. `scores` is the whole cohort including this student's
 * own attempt — leaving it out would inflate every result slightly and,
 * on a small cohort, visibly.
 */
export function percentileRank(score: number, scores: number[]): PercentileResult {
  const cohortSize = scores.length;
  if (cohortSize < MIN_COHORT_FOR_PERCENTILE) {
    return { percentile: null, cohortSize, reason: 'cohort_too_small' };
  }

  let below = 0;
  let equal = 0;
  for (const s of scores) {
    if (s < score) below++;
    else if (s === score) equal++;
  }

  const pct = ((below + equal / 2) / cohortSize) * 100;
  return { percentile: Math.round(pct * 10) / 10, cohortSize, reason: 'ok' };
}

/**
 * §7.2 — a percentile is only offered for a static form.
 *
 * Returned as a reason rather than a silent null so the report can say "غير
 * قابل للمقارنة (نموذج مخصص)" instead of leaving a blank the reader fills in
 * with their own guess.
 */
export function cohortPercentile(
  score: number,
  scores: number[],
  isStaticForm: boolean,
): PercentileResult {
  if (!isStaticForm) return { percentile: null, cohortSize: scores.length, reason: 'not_comparable' };
  return percentileRank(score, scores);
}

/** قوي / متوسط / يحتاج عمل — §7.3's band beside each part. */
export type Band = 'strong' | 'fair' | 'needs_work';

export function bandFor(accuracy: number): Band {
  if (accuracy >= 75) return 'strong';
  if (accuracy >= 50) return 'fair';
  return 'needs_work';
}

export const BAND_AR: Record<Band, string> = {
  strong: 'قوي',
  fair: 'متوسط',
  needs_work: 'يحتاج عمل',
};
