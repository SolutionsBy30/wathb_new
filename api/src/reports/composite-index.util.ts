// Composite index — SRS §1.3.1 "المؤشر المركّب": a single 0-100 number
// summarizing a student's overall level, combining their accuracy across
// every area weighted by that area's section weight (curriculum
// importance) — the only weight granularity the taxonomy has today.
// Explicitly not a predicted test score, just an internal progress index
// (SRS §9 open-question recommendation #7).

export interface LabelStatForComposite {
  nAnswered: number;
  nCorrect: number;
  areaId: string;
  sectionWeight: number;
}

export function computeCompositeIndex(stats: LabelStatForComposite[], minSample: number): number | null {
  const byArea = new Map<string, { nAnswered: number; nCorrect: number; weight: number }>();
  for (const s of stats) {
    const bucket = byArea.get(s.areaId) ?? { nAnswered: 0, nCorrect: 0, weight: s.sectionWeight };
    bucket.nAnswered += s.nAnswered;
    bucket.nCorrect += s.nCorrect;
    byArea.set(s.areaId, bucket);
  }
  // Same statistical-honesty floor as everywhere else — an area below the
  // sample floor doesn't get to vote on the headline number either.
  const reportable = [...byArea.values()].filter((a) => a.nAnswered >= minSample && a.weight > 0);
  if (reportable.length === 0) return null;
  const weightSum = reportable.reduce((sum, a) => sum + a.weight, 0);
  const weightedSum = reportable.reduce((sum, a) => sum + (a.nCorrect / a.nAnswered) * a.weight, 0);
  return Math.round((weightedSum / weightSum) * 100);
}
