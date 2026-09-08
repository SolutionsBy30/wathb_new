import {
  BAND_AR,
  bandFor,
  cohortPercentile,
  MIN_COHORT_FOR_PERCENTILE,
  percentileRank,
} from './percentile.util';

/** A cohort big enough to clear the floor, with a known shape. */
const cohortOf = (n: number, fill: (i: number) => number) => Array.from({ length: n }, (_, i) => fill(i));

describe('percentileRank', () => {
  it('withholds a percentile from a cohort too small to carry one', () => {
    const r = percentileRank(50, [10, 20, 30, 40, 50]);
    expect(r).toEqual({ percentile: null, cohortSize: 5, reason: 'cohort_too_small' });
  });

  it('withholds at exactly one below the floor', () => {
    const scores = cohortOf(MIN_COHORT_FOR_PERCENTILE - 1, (i) => i);
    expect(percentileRank(5, scores).reason).toBe('cohort_too_small');
  });

  it('reports at exactly the floor', () => {
    const scores = cohortOf(MIN_COHORT_FOR_PERCENTILE, (i) => i);
    expect(percentileRank(0, scores).reason).toBe('ok');
  });

  it('places the lowest score of a distinct cohort below the midpoint of its own tie', () => {
    // 0 below, 1 equal (itself) out of 20 → (0 + 0.5) / 20 = 2.5%
    const scores = cohortOf(20, (i) => i);
    expect(percentileRank(0, scores).percentile).toBe(2.5);
  });

  it('places the highest score just under 100, never at it', () => {
    // 19 below, 1 equal out of 20 → (19 + 0.5) / 20 = 97.5%
    const scores = cohortOf(20, (i) => i);
    expect(percentileRank(19, scores).percentile).toBe(97.5);
  });

  it('gives half credit for ties, so identical scores get identical standing', () => {
    // Ten 40s and ten 80s. A 40 has 0 below and 10 equal → 25%.
    const scores = [...cohortOf(10, () => 40), ...cohortOf(10, () => 80)];
    expect(percentileRank(40, scores).percentile).toBe(25);
    expect(percentileRank(80, scores).percentile).toBe(75);
  });

  it('does not put an everybody-scored-the-same cohort at 0 or 100', () => {
    const scores = cohortOf(20, () => 60);
    expect(percentileRank(60, scores).percentile).toBe(50);
  });

  it('counts the cohort it was given, including this student own attempt', () => {
    const scores = cohortOf(40, (i) => i);
    expect(percentileRank(20, scores).cohortSize).toBe(40);
  });

  it('rounds to one decimal', () => {
    const scores = cohortOf(30, (i) => i);
    const r = percentileRank(7, scores);
    expect(r.percentile).toBe(25);
    expect(Number.isInteger(r.percentile! * 10)).toBe(true);
  });

  it('handles a score above everything in the cohort', () => {
    const scores = cohortOf(20, (i) => i);
    expect(percentileRank(999, scores).percentile).toBe(100);
  });

  it('handles a score below everything in the cohort', () => {
    const scores = cohortOf(20, (i) => i + 10);
    expect(percentileRank(0, scores).percentile).toBe(0);
  });
});

describe('cohortPercentile', () => {
  it('refuses a percentile for a dynamic form, whatever the cohort size', () => {
    const scores = cohortOf(500, (i) => i % 100);
    const r = cohortPercentile(50, scores, false);
    expect(r).toEqual({ percentile: null, cohortSize: 500, reason: 'not_comparable' });
  });

  it('reports a percentile for a static form with a real cohort', () => {
    const scores = cohortOf(50, (i) => i);
    expect(cohortPercentile(25, scores, true).reason).toBe('ok');
  });

  it('still applies the cohort floor to a static form', () => {
    expect(cohortPercentile(5, [1, 2, 3], true).reason).toBe('cohort_too_small');
  });
});

describe('bandFor', () => {
  it('bands accuracy into قوي / متوسط / يحتاج عمل', () => {
    expect(bandFor(90)).toBe('strong');
    expect(bandFor(75)).toBe('strong');
    expect(bandFor(74.9)).toBe('fair');
    expect(bandFor(50)).toBe('fair');
    expect(bandFor(49.9)).toBe('needs_work');
    expect(bandFor(0)).toBe('needs_work');
  });

  it('has an Arabic label for every band', () => {
    for (const a of [0, 50, 75, 100]) {
      expect(BAND_AR[bandFor(a)]).toBeTruthy();
    }
  });
});
