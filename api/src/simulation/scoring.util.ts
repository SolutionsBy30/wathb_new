/**
 * SIM-008 — §7.1 scoring and §7.2 pacing, as a pure function.
 *
 * Two rules dominate everything here:
 *
 * 1. Experimental items are excluded from every score surface (§7.1,
 *    acceptance criterion 4) but still gather statistics. Every count in the
 *    result object is therefore over scored items only, and the experimental
 *    ones are summarised separately.
 * 2. Nothing produced here is an official Qiyas score. `scaledEstimate` stays
 *    null unless a scoring profile exists — §12.1 is unresolved, and a
 *    plausible-looking invented number is worse than no number at all,
 *    because a student will plan around it.
 */

export type Part = 'verbal' | 'quantitative' | 'mixed';

export interface ScoredAnswer {
  sectionIndex: number;
  position: number;
  areaId: string;
  areaNameAr: string;
  /** Authored 1..5. Bands are derived from this, not from p-value, so the
   *  student's report does not shift under them as the bank recalibrates. */
  difficulty: number;
  isScored: boolean;
  selectedKey: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number;
  flagged: boolean;
}

export interface SectionMeta {
  sectionIndex: number;
  part: Part;
  /** True when the section ended on the clock rather than by "إنهاء القسم". */
  timedOut: boolean;
}

export interface AreaBreakdownRow {
  areaId: string;
  areaNameAr: string;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  meanTimeMs: number;
}

export interface SectionBreakdownRow {
  sectionIndex: number;
  part: Part;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  timedOut: boolean;
}

export interface DifficultyBandRow {
  band: 'easy' | 'medium' | 'hard';
  total: number;
  correct: number;
  accuracy: number;
}

export interface Pacing {
  meanTimeMs: number;
  /** §7.2 — answered in under 10s: a guessing signal. */
  rushedCount: number;
  /** §7.2 — over 90s: time sinks. */
  timeSinkCount: number;
  unansweredCount: number;
  flaggedCount: number;
  screenExits: number;
  difficultyBands: DifficultyBandRow[];
  /**
   * §7.2 "collapse point" — the first section-half where accuracy falls below
   * 60% of the student's own first-half accuracy. Null when they held up.
   * Relative to their own baseline, not an absolute threshold: a student
   * averaging 45% has not "collapsed" by scoring 40% at the end.
   */
  collapseSectionIndex: number | null;
}

export interface SimulationScore {
  rawScore: number;
  scoredCount: number;
  accuracy: number;
  verbalEstimate: number | null;
  quantEstimate: number | null;
  areaBreakdown: AreaBreakdownRow[];
  sectionBreakdown: SectionBreakdownRow[];
  pacing: Pacing;
  /** Unscored pilot items, kept out of every number above (§7.1). */
  experimental: { total: number; correct: number };
}

export const RUSHED_MS = 10_000;
export const TIME_SINK_MS = 90_000;

const pct = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 1000) / 10);

/** Authored 1..5 → the three bands a student sees. */
export function difficultyBand(difficulty: number): 'easy' | 'medium' | 'hard' {
  if (difficulty <= 2) return 'easy';
  if (difficulty >= 4) return 'hard';
  return 'medium';
}

/**
 * An unanswered item counts as wrong for the score but is reported separately.
 *
 * Both facts matter and they are different questions: "how many did you get
 * right" is the score, and "how many did you never reach" is the pacing
 * problem that caused it. Collapsing them hides the second one entirely.
 */
function isCorrect(a: ScoredAnswer): boolean {
  return a.isCorrect === true;
}
function isUnanswered(a: ScoredAnswer): boolean {
  return a.selectedKey === null;
}

export function scoreAttempt(answers: ScoredAnswer[], sections: SectionMeta[], screenExits = 0): SimulationScore {
  const scored = answers.filter((a) => a.isScored);
  const experimental = answers.filter((a) => !a.isScored);

  const rawScore = scored.filter(isCorrect).length;

  const partOf = new Map(sections.map((s) => [s.sectionIndex, s.part]));

  const estimateFor = (part: Part): number | null => {
    const inPart = scored.filter((a) => partOf.get(a.sectionIndex) === part);
    // Null rather than 0 when the blueprint has no such section — a تحصيلي
    // blueprint has no verbal/quantitative split, and reporting 0% verbal
    // would read as "answered nothing right" instead of "not applicable".
    if (inPart.length === 0) return null;
    return pct(inPart.filter(isCorrect).length, inPart.length);
  };

  const areaIds = [...new Set(scored.map((a) => a.areaId))];
  const areaBreakdown: AreaBreakdownRow[] = areaIds
    .map((areaId) => {
      const rows = scored.filter((a) => a.areaId === areaId);
      const correct = rows.filter(isCorrect).length;
      const unanswered = rows.filter(isUnanswered).length;
      return {
        areaId,
        areaNameAr: rows[0].areaNameAr,
        total: rows.length,
        correct,
        wrong: rows.length - correct - unanswered,
        unanswered,
        accuracy: pct(correct, rows.length),
        meanTimeMs: Math.round(rows.reduce((n, r) => n + r.timeSpentMs, 0) / rows.length),
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  const sectionBreakdown: SectionBreakdownRow[] = sections
    .map((s) => {
      const rows = scored.filter((a) => a.sectionIndex === s.sectionIndex);
      const correct = rows.filter(isCorrect).length;
      const unanswered = rows.filter(isUnanswered).length;
      return {
        sectionIndex: s.sectionIndex,
        part: s.part,
        total: rows.length,
        correct,
        wrong: rows.length - correct - unanswered,
        unanswered,
        accuracy: pct(correct, rows.length),
        timedOut: s.timedOut,
      };
    })
    .sort((a, b) => a.sectionIndex - b.sectionIndex);

  const bands: DifficultyBandRow[] = (['easy', 'medium', 'hard'] as const).map((band) => {
    const rows = scored.filter((a) => difficultyBand(a.difficulty) === band);
    const correct = rows.filter(isCorrect).length;
    return { band, total: rows.length, correct, accuracy: pct(correct, rows.length) };
  });

  // Collapse point: compare each section's accuracy to the first section the
  // student actually sat, so it measures their own fade rather than the
  // difficulty ramp built into every form.
  const sat = sectionBreakdown.filter((s) => s.total > 0);
  let collapseSectionIndex: number | null = null;
  if (sat.length >= 2) {
    const baseline = sat[0].accuracy;
    const fell = sat.slice(1).find((s) => baseline > 0 && s.accuracy < baseline * 0.6);
    collapseSectionIndex = fell ? fell.sectionIndex : null;
  }

  const answered = scored.filter((a) => !isUnanswered(a));
  const pacing: Pacing = {
    meanTimeMs: answered.length === 0 ? 0 : Math.round(answered.reduce((n, a) => n + a.timeSpentMs, 0) / answered.length),
    rushedCount: answered.filter((a) => a.timeSpentMs < RUSHED_MS).length,
    timeSinkCount: answered.filter((a) => a.timeSpentMs > TIME_SINK_MS).length,
    unansweredCount: scored.filter(isUnanswered).length,
    flaggedCount: scored.filter((a) => a.flagged).length,
    screenExits,
    difficultyBands: bands,
    collapseSectionIndex,
  };

  return {
    rawScore,
    scoredCount: scored.length,
    accuracy: pct(rawScore, scored.length),
    verbalEstimate: estimateFor('verbal'),
    quantEstimate: estimateFor('quantitative'),
    areaBreakdown,
    sectionBreakdown,
    pacing,
    experimental: { total: experimental.length, correct: experimental.filter(isCorrect).length },
  };
}

/**
 * §7.1 — raw → scaled, through the blueprint's versioned profile.
 *
 * Returns null when no profile is active. That is the honest answer at launch
 * (§12.1) and it is deliberately not a fallback formula: an invented mapping
 * would be indistinguishable from a real one on screen, and a student would
 * plan a قياس sitting around it.
 */
export function applyScoringProfile(rawScore: number, rawToScaled: unknown): number | null {
  if (!rawToScaled || typeof rawToScaled !== 'object') return null;
  const table = rawToScaled as Record<string, unknown>;
  const hit = table[String(rawScore)];
  return typeof hit === 'number' && Number.isFinite(hit) ? Math.round(hit) : null;
}
