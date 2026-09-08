/**
 * SIM-020 — §7.5 "خطة ما بعد المحاكي", as a pure function.
 *
 * "Post-simulation, the next 7 daily Wathbat are biased toward the two weakest
 * areas identified." A simulation is the largest, cleanest sample the platform
 * ever gets from a student, so it should move the plan — but §7.5 also says
 * the influence is "capped so one bad sitting doesn't dominate". Both halves
 * matter, and both live here rather than in the generation service, so the
 * rule can be read and tested in one place.
 *
 * A weight, never a filter: the biased areas are made more likely, not
 * mandatory. Forcing them would leave the rest of the syllabus unmeasured for
 * a week, which is exactly what SEL-001's section rotation exists to prevent.
 */

/** §7.5 — "the next 7 daily Wathbat". */
export const PLAN_BIAS_DAYS = 7;

/** §7.5 — "the two weakest areas identified". */
export const PLAN_BIAS_AREA_COUNT = 2;

/**
 * How much more likely a biased label becomes.
 *
 * 2.5× is a strong nudge and a deliberate ceiling. The weakness signal, the
 * recency penalty and the weakness floor all still apply on top, so a biased
 * area that the student then improves at stops dominating on its own — the
 * cap is what stops one bad morning from owning the following week.
 */
export const PLAN_BIAS_MULTIPLIER = 2.5;

/**
 * An area needs at least this many scored items in the simulation before its
 * accuracy is treated as a finding.
 *
 * A three-question area at 0% is a bad run, not a weakness, and biasing a
 * whole week toward it on that evidence would be worse than not biasing at
 * all. Areas below the floor keep their normal weight.
 */
export const MIN_ITEMS_FOR_BIAS = 4;

export interface AreaResult {
  areaId: string;
  accuracy: number;
  total: number;
}

export interface PlanBias {
  areaIds: string[];
  multiplier: number;
  activeUntil: Date;
}

/** The weakest areas that carry enough items to be believed. */
export function planBiasAreas(areas: AreaResult[], count = PLAN_BIAS_AREA_COUNT): string[] {
  return [...areas]
    .filter((a) => a.total >= MIN_ITEMS_FOR_BIAS)
    // Ties broken by the larger area: more items is the stronger evidence, so
    // the ordering does not depend on how the rows happened to arrive.
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, count)
    .map((a) => a.areaId);
}

export function planBiasExpiry(finalizedAt: Date): Date {
  return new Date(finalizedAt.getTime() + PLAN_BIAS_DAYS * 86_400_000);
}

export function isPlanBiasActive(finalizedAt: Date, now: Date): boolean {
  return now < planBiasExpiry(finalizedAt);
}

/**
 * The whole bias for one finalized attempt, or null when it has lapsed or
 * nothing in it was measured well enough to act on.
 */
export function planBiasFor(areas: AreaResult[], finalizedAt: Date, now: Date): PlanBias | null {
  if (!isPlanBiasActive(finalizedAt, now)) return null;
  const areaIds = planBiasAreas(areas);
  if (areaIds.length === 0) return null;
  return { areaIds, multiplier: PLAN_BIAS_MULTIPLIER, activeUntil: planBiasExpiry(finalizedAt) };
}

/** The multiplier to apply to one label or section, given the active bias. */
export function multiplierFor(areaId: string, bias: PlanBias | null): number {
  if (!bias) return 1;
  return bias.areaIds.includes(areaId) ? bias.multiplier : 1;
}
