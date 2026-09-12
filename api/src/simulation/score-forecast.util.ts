/**
 * SIM-023 — a score forecast from a student's simulation history.
 *
 * Built from the three figures that carry real information: the lowest and
 * highest they have scored under exam conditions, and the most recent one.
 *
 * Expressed as a RANGE with a most-likely value, never as a single number.
 * A student who has scored 58, 71 and 64 does not "have a 64"; they have a
 * demonstrated span, and a school planning support classes needs to see the
 * span — the bottom of it is what happens on a bad day, which is the day that
 * usually decides an exam result.
 *
 * Still not a Qiyas score. These are percentages on وثب's own simulation, and
 * every surface that shows one carries FORECAST_DISCLAIMER_AR saying so. The
 * difference from the daily-practice band is that a simulation is sat under
 * exam conditions, which makes it a far better predictor — not an official one.
 */

export interface AttemptScore {
  /** Percentage of scored items answered correctly. */
  accuracy: number;
  finalizedAt: Date;
}

export type ForecastConfidence = 'none' | 'low' | 'moderate' | 'good';

export type Trend = 'improving' | 'declining' | 'steady' | 'unknown';

export interface ScoreForecast {
  /** Most recent attempt — the best single estimate of where they are now. */
  likely: number;
  /** Lowest and highest observed. The floor is the number that matters most. */
  low: number;
  high: number;
  /** How far apart the two are. A wide span is itself the finding. */
  spread: number;
  attempts: number;
  confidence: ForecastConfidence;
  trend: Trend;
  /** True when the span is wide enough that the student is inconsistent. */
  volatile: boolean;
  lastAttemptAt: Date;
}

/**
 * A spread beyond this means performance is not stable enough for the midpoint
 * to mean much, and the school should read the floor rather than the average.
 */
export const VOLATILE_SPREAD = 15;

/** Below this, a difference between two attempts is noise, not a direction. */
export const TREND_EPSILON = 3;

/**
 * One attempt gives a point, not a range. Two give a span but no shape. Three
 * is where a trend starts to mean something — hence the tiers, which the UI
 * shows so nobody reads a single sitting as a settled forecast.
 */
export function confidenceFor(attempts: number): ForecastConfidence {
  if (attempts <= 0) return 'none';
  if (attempts === 1) return 'low';
  if (attempts === 2) return 'moderate';
  return 'good';
}

/**
 * Direction of travel, from the most recent attempt against the one before it.
 *
 * Deliberately last-vs-previous rather than a fit across all attempts: a
 * student who scored 50, 55, 80 is improving, and a regression line through
 * three points would say the same thing more slowly and less legibly. What a
 * school acts on is "are they going up right now".
 */
export function trendFor(sorted: AttemptScore[]): Trend {
  if (sorted.length < 2) return 'unknown';
  const last = sorted[sorted.length - 1].accuracy;
  const previous = sorted[sorted.length - 2].accuracy;
  const delta = last - previous;
  if (Math.abs(delta) < TREND_EPSILON) return 'steady';
  return delta > 0 ? 'improving' : 'declining';
}

/**
 * @param attempts finalized simulation attempts, in any order — sorted here so
 *                 the caller cannot get "most recent" wrong.
 */
export function forecast(attempts: AttemptScore[]): ScoreForecast | null {
  if (attempts.length === 0) return null;

  const sorted = [...attempts].sort((a, b) => a.finalizedAt.getTime() - b.finalizedAt.getTime());
  const values = sorted.map((a) => a.accuracy);
  const last = sorted[sorted.length - 1];

  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.round((high - low) * 10) / 10;

  return {
    likely: Math.round(last.accuracy * 10) / 10,
    low: Math.round(low * 10) / 10,
    high: Math.round(high * 10) / 10,
    spread,
    attempts: sorted.length,
    confidence: confidenceFor(sorted.length),
    trend: trendFor(sorted),
    volatile: spread >= VOLATILE_SPREAD,
    lastAttemptAt: last.finalizedAt,
  };
}

export const CONFIDENCE_AR: Record<ForecastConfidence, string> = {
  none: 'لا توجد محاولات',
  low: 'محاولة واحدة — مؤشر أولي',
  moderate: 'محاولتان',
  good: 'ثلاث محاولات أو أكثر',
};

export const TREND_AR: Record<Trend, string> = {
  improving: 'في تحسّن',
  declining: 'في تراجع',
  steady: 'مستقر',
  unknown: 'يحتاج محاولة أخرى',
};

export const FORECAST_DISCLAIMER_AR =
  'التوقّع مبني على نتائج المحاكي في وثب تحت ظروف الاختبار، وهو تقدير لأداء الطالب وليس درجة قياس رسمية.';

/**
 * A one-line reading for a school, phrased so the floor is not lost.
 *
 * The bottom of the range is what a school should plan around: it is what the
 * student produces on a bad morning, and a bad morning is frequently the one
 * that counts.
 */
export function describeForecastAr(f: ScoreForecast): string {
  if (f.attempts === 1) {
    return `محاولة واحدة بنتيجة ${f.likely}٪ — يحتاج محاولة ثانية قبل الاعتماد على التوقّع.`;
  }
  const base = `النطاق ${f.low}٪ – ${f.high}٪، وآخر نتيجة ${f.likely}٪ (${TREND_AR[f.trend]}).`;
  return f.volatile
    ? `${base} الفارق بين أفضل وأسوأ محاولة ${f.spread} نقطة — أداء غير مستقر، والأجدر التخطيط على أساس الحد الأدنى.`
    : base;
}

// ------------------------------------------------------------ cohort view

export interface CohortForecast {
  /** Students with at least one finalized simulation. */
  forecasted: number;
  /** Students with none — a forecast cannot be offered for them at all. */
  unforecasted: number;
  /** Mean of each student's most recent attempt. */
  meanLikely: number | null;
  /** Mean of each student's worst attempt: the school's realistic floor. */
  meanLow: number | null;
  /** How many students are inconsistent enough to need exam-technique work. */
  volatile: number;
  improving: number;
  declining: number;
}

/**
 * Roll per-student forecasts into a school-level picture.
 *
 * meanLow is reported alongside meanLikely on purpose. A school reading only
 * the likely figure plans for its students' good days; the floor is what it
 * should staff for.
 */
export function summariseForecasts(forecasts: (ScoreForecast | null)[]): CohortForecast {
  const present = forecasts.filter((f): f is ScoreForecast => f !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

  return {
    forecasted: present.length,
    unforecasted: forecasts.length - present.length,
    meanLikely: avg(present.map((f) => f.likely)),
    meanLow: avg(present.map((f) => f.low)),
    volatile: present.filter((f) => f.volatile).length,
    improving: present.filter((f) => f.trend === 'improving').length,
    declining: present.filter((f) => f.trend === 'declining').length,
  };
}
