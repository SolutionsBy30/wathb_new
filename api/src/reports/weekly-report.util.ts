// Pure logic behind the weekly report (spec §5.3, §6.5) — unit-testable
// independent of the DB, same discipline as the selection engine.

export interface WeeklyLabelStat {
  labelId: string;
  nameAr: string;
  nAnswered: number;
  nCorrect: number;
  meanTimeMs: number;
  targetTimeS: number;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  accuracy: number | null;
}

export type AccuracyBand = 'low' | 'mid' | 'high';
export type SpeedBand = 'slow' | 'on_pace' | 'fast';

export function accuracyBand(accuracy: number): AccuracyBand {
  if (accuracy < 0.5) return 'low';
  if (accuracy < 0.75) return 'mid';
  return 'high';
}

export function speedBand(meanTimeS: number, targetTimeS: number): SpeedBand {
  if (meanTimeS > targetTimeS * 1.15) return 'slow';
  if (meanTimeS < targetTimeS * 0.85) return 'fast';
  return 'on_pace';
}

/** Picks the strongest/weakest label, gated by the same MIN_SAMPLE_FOR_REPORTING discipline as the report. */
export function pickTopStrengthWeakness(
  labels: WeeklyLabelStat[],
  minSample: number,
): { strength: WeeklyLabelStat | null; weakness: WeeklyLabelStat | null } {
  const reportable = labels.filter((l) => l.nAnswered >= minSample);
  if (reportable.length === 0) return { strength: null, weakness: null };
  const sorted = [...reportable].sort((a, b) => b.nCorrect / b.nAnswered - a.nCorrect / a.nAnswered);
  return { strength: sorted[0], weakness: sorted[sorted.length - 1] };
}

/** Composite accuracy this week minus last week, or null if there isn't two weeks of data yet. */
export function compositeDelta(trend: WeeklyTrendPoint[]): number | null {
  const withData = trend.filter((t) => t.accuracy !== null);
  if (withData.length < 2) return null;
  const last = withData[withData.length - 1].accuracy!;
  const prev = withData[withData.length - 2].accuracy!;
  return last - prev;
}
