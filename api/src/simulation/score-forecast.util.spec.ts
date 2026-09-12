import {
  AttemptScore,
  confidenceFor,
  describeForecastAr,
  forecast,
  summariseForecasts,
  TREND_EPSILON,
  trendFor,
  VOLATILE_SPREAD,
} from './score-forecast.util';

const T0 = new Date('2026-06-01T00:00:00.000Z');
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const at = (accuracy: number, n: number): AttemptScore => ({ accuracy, finalizedAt: day(n) });

describe('confidenceFor', () => {
  it('tiers by how many sittings there are', () => {
    expect(confidenceFor(0)).toBe('none');
    expect(confidenceFor(1)).toBe('low');
    expect(confidenceFor(2)).toBe('moderate');
    expect(confidenceFor(3)).toBe('good');
    expect(confidenceFor(9)).toBe('good');
  });
});

describe('trendFor', () => {
  it('cannot read a trend from one attempt', () => {
    expect(trendFor([at(60, 0)])).toBe('unknown');
    expect(trendFor([])).toBe('unknown');
  });

  it('reads the latest move, not the whole history', () => {
    // 50 → 55 → 80 is improving; a line fitted through all three would say the
    // same thing more slowly.
    expect(trendFor([at(50, 0), at(55, 7), at(80, 14)])).toBe('improving');
  });

  it('reads a decline', () => {
    expect(trendFor([at(80, 0), at(60, 7)])).toBe('declining');
  });

  it('treats a small move as steady rather than a direction', () => {
    expect(trendFor([at(70, 0), at(70 + TREND_EPSILON - 0.1, 7)])).toBe('steady');
    expect(trendFor([at(70, 0), at(70 - TREND_EPSILON + 0.1, 7)])).toBe('steady');
  });

  it('calls a move at the epsilon a direction', () => {
    expect(trendFor([at(70, 0), at(70 + TREND_EPSILON, 7)])).toBe('improving');
  });
});

describe('forecast', () => {
  it('offers nothing without a simulation', () => {
    expect(forecast([])).toBeNull();
  });

  it('uses the most recent attempt as the likely value', () => {
    const f = forecast([at(58, 0), at(71, 7), at(64, 14)])!;
    expect(f.likely).toBe(64);
  });

  it('takes the range from the best and worst ever sat', () => {
    const f = forecast([at(58, 0), at(71, 7), at(64, 14)])!;
    expect(f.low).toBe(58);
    expect(f.high).toBe(71);
    expect(f.spread).toBe(13);
  });

  it('sorts by date, so the caller cannot get "most recent" wrong', () => {
    const shuffled = [at(64, 14), at(58, 0), at(71, 7)];
    expect(forecast(shuffled)!.likely).toBe(64);
    expect(forecast(shuffled)!.trend).toBe('declining');
  });

  it('handles a single attempt without pretending it is a range', () => {
    const f = forecast([at(66, 0)])!;
    expect(f).toMatchObject({ likely: 66, low: 66, high: 66, spread: 0, attempts: 1, confidence: 'low', trend: 'unknown' });
  });

  it('flags an inconsistent student', () => {
    const f = forecast([at(45, 0), at(45 + VOLATILE_SPREAD, 7)])!;
    expect(f.volatile).toBe(true);
  });

  it('does not flag a consistent one', () => {
    const f = forecast([at(60, 0), at(66, 7), at(63, 14)])!;
    expect(f.volatile).toBe(false);
  });

  it('carries the date of the latest sitting', () => {
    expect(forecast([at(58, 0), at(64, 20)])!.lastAttemptAt).toEqual(day(20));
  });

  it('rounds to one decimal rather than emitting float noise', () => {
    const f = forecast([at(58.333333, 0), at(71.666666, 7)])!;
    expect(f.low).toBe(58.3);
    expect(f.high).toBe(71.7);
    expect(f.likely).toBe(71.7);
  });

  it('handles a perfect and a zero score', () => {
    const f = forecast([at(0, 0), at(100, 7)])!;
    expect(f).toMatchObject({ low: 0, high: 100, spread: 100, volatile: true });
  });
});

describe('describeForecastAr', () => {
  it('asks for a second sitting when there is only one', () => {
    expect(describeForecastAr(forecast([at(66, 0)])!)).toContain('محاولة ثانية');
  });

  it('leads with the range and the latest result', () => {
    const text = describeForecastAr(forecast([at(58, 0), at(64, 7)])!);
    expect(text).toContain('58');
    expect(text).toContain('64');
  });

  it('warns to plan on the floor when the student is inconsistent', () => {
    const text = describeForecastAr(forecast([at(40, 0), at(75, 7)])!);
    expect(text).toContain('غير مستقر');
    expect(text).toContain('الحد الأدنى');
  });
});

describe('summariseForecasts', () => {
  const a = forecast([at(50, 0), at(60, 7)]);
  const b = forecast([at(70, 0), at(90, 7)]);
  const none = null;

  it('counts who can and cannot be forecast', () => {
    const s = summariseForecasts([a, b, none]);
    expect(s.forecasted).toBe(2);
    expect(s.unforecasted).toBe(1);
  });

  it('reports the cohort floor beside the likely mean', () => {
    // A school reading only the likely figure plans for its students' good
    // days; meanLow is what it should staff for.
    const s = summariseForecasts([a, b]);
    expect(s.meanLikely).toBe(75);
    expect(s.meanLow).toBe(60);
  });

  it('counts volatile and moving students', () => {
    const s = summariseForecasts([a, b]);
    expect(s.volatile).toBe(1); // b spans 20 points
    expect(s.improving).toBe(2);
    expect(s.declining).toBe(0);
  });

  it('returns nulls rather than zeros when nobody has sat one', () => {
    const s = summariseForecasts([null, null]);
    expect(s).toMatchObject({ forecasted: 0, unforecasted: 2, meanLikely: null, meanLow: null });
  });

  it('handles an empty school', () => {
    expect(summariseForecasts([])).toMatchObject({ forecasted: 0, unforecasted: 0, meanLikely: null });
  });
});
