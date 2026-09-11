import {
  DEFAULT_MAX_INTERVAL_MS,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_SUPPRESS_AFTER_RUNS,
  effectiveDailyCap,
  nextIntervalMs,
  readReachability,
  scheduledSendAt,
  sendOffsetMs,
  shouldSuppress,
  SPREAD_FRACTION,
  WARMUP_DAYS,
  WARMUP_FIRST_DAY_CAP,
  withinDailyCap,
} from './compliance.util';

describe('shouldSuppress', () => {
  it('holds off below the threshold', () => {
    expect(shouldSuppress(DEFAULT_SUPPRESS_AFTER_RUNS - 1)).toBe(false);
  });

  it('suppresses at the threshold', () => {
    expect(shouldSuppress(DEFAULT_SUPPRESS_AFTER_RUNS)).toBe(true);
  });

  it('honours a configured threshold', () => {
    expect(shouldSuppress(2, 5)).toBe(false);
    expect(shouldSuppress(5, 5)).toBe(true);
  });

  it('never suppresses a number that has not failed', () => {
    expect(shouldSuppress(0)).toBe(false);
  });
});

describe('nextIntervalMs', () => {
  it('never goes below the floor', () => {
    expect(nextIntervalMs(5500, 12000, () => 0)).toBe(5500);
  });

  it('never goes above the ceiling', () => {
    expect(nextIntervalMs(5500, 12000, () => 0.999999)).toBeLessThanOrEqual(12000);
  });

  it('spreads across the range', () => {
    expect(nextIntervalMs(5000, 15000, () => 0.5)).toBe(10000);
  });

  it('falls back to the floor when the ceiling is misconfigured below it', () => {
    // A max below the min is a typo, not permission to send faster.
    expect(nextIntervalMs(8000, 2000, () => 0.9)).toBe(8000);
  });

  it('treats a negative floor as zero rather than scheduling in the past', () => {
    expect(nextIntervalMs(-1000, 4000, () => 0)).toBe(0);
  });

  it('produces varied gaps across many draws', () => {
    const seen = new Set(Array.from({ length: 200 }, () => nextIntervalMs()));
    // The point of jitter is that the interval is not one repeated number.
    expect(seen.size).toBeGreaterThan(50);
    for (const v of seen) {
      expect(v).toBeGreaterThanOrEqual(DEFAULT_MIN_INTERVAL_MS);
      expect(v).toBeLessThanOrEqual(DEFAULT_MAX_INTERVAL_MS);
    }
  });
});

describe('sendOffsetMs', () => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  it('is stable for the same student', () => {
    expect(sendOffsetMs('student-a', TWO_HOURS)).toBe(sendOffsetMs('student-a', TWO_HOURS));
  });

  it('differs between students', () => {
    const offsets = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => sendOffsetMs(k, TWO_HOURS));
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });

  it('leaves the tail of the window free for retries', () => {
    for (const k of Array.from({ length: 300 }, (_, i) => `student-${i}`)) {
      expect(sendOffsetMs(k, TWO_HOURS)).toBeLessThan(TWO_HOURS * SPREAD_FRACTION);
    }
  });

  it('spreads a real roster across most of the window rather than bunching', () => {
    const buckets = new Set(
      Array.from({ length: 200 }, (_, i) => Math.floor(sendOffsetMs(`s${i}`, TWO_HOURS) / (10 * 60_000))),
    );
    // 10-minute buckets across the usable ~96 minutes: at least half should
    // be occupied, or the hash is not spreading.
    expect(buckets.size).toBeGreaterThanOrEqual(5);
  });

  it('returns zero for a window with no width', () => {
    expect(sendOffsetMs('a', 0)).toBe(0);
    expect(sendOffsetMs('a', -1)).toBe(0);
  });

  it('places the send inside the window', () => {
    const start = new Date('2026-09-11T15:00:00.000Z');
    const end = new Date('2026-09-11T17:00:00.000Z');
    for (const k of Array.from({ length: 100 }, (_, i) => `k${i}`)) {
      const at = scheduledSendAt(k, start, end);
      expect(at.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(at.getTime()).toBeLessThan(end.getTime());
    }
  });
});

describe('effectiveDailyCap', () => {
  const T0 = new Date('2026-09-01T00:00:00.000Z');
  const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

  it('is uncapped when nothing is configured', () => {
    expect(effectiveDailyCap(null, null)).toBeNull();
  });

  it('returns the configured cap when there is no warm-up', () => {
    expect(effectiveDailyCap(300, null)).toBe(300);
  });

  it('starts a warming number at the first-day allowance', () => {
    expect(effectiveDailyCap(300, T0, T0)).toBe(WARMUP_FIRST_DAY_CAP);
  });

  it('reaches the full cap on the last warm-up day', () => {
    expect(effectiveDailyCap(300, T0, day(WARMUP_DAYS - 1))).toBe(300);
  });

  it('rises monotonically through the ramp', () => {
    let prev = 0;
    for (let d = 0; d < WARMUP_DAYS; d++) {
      const v = effectiveDailyCap(300, T0, day(d))!;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('never exceeds the configured cap mid-ramp', () => {
    for (let d = 0; d < WARMUP_DAYS; d++) {
      expect(effectiveDailyCap(100, T0, day(d))!).toBeLessThanOrEqual(100);
    }
  });

  it('returns the plain cap once warm-up is over', () => {
    expect(effectiveDailyCap(300, T0, day(WARMUP_DAYS))).toBe(300);
    expect(effectiveDailyCap(null, T0, day(WARMUP_DAYS + 5))).toBeNull();
  });

  it('ramps toward a default target when no cap is set', () => {
    const early = effectiveDailyCap(null, T0, T0)!;
    const later = effectiveDailyCap(null, T0, day(7))!;
    expect(early).toBe(WARMUP_FIRST_DAY_CAP);
    expect(later).toBeGreaterThan(early);
  });

  it('treats a future warm-up date as day one rather than a negative allowance', () => {
    const v = effectiveDailyCap(300, day(5), T0)!;
    expect(v).toBe(WARMUP_FIRST_DAY_CAP);
  });

  it('does not ramp above a cap already below the first-day allowance', () => {
    expect(effectiveDailyCap(5, T0, T0)).toBe(5);
    expect(effectiveDailyCap(5, T0, day(10))).toBe(5);
  });
});

describe('withinDailyCap', () => {
  it('allows everything when uncapped', () => {
    expect(withinDailyCap(99_999, null)).toBe(true);
  });

  it('allows up to the cap and refuses at it', () => {
    expect(withinDailyCap(99, 100)).toBe(true);
    expect(withinDailyCap(100, 100)).toBe(false);
    expect(withinDailyCap(101, 100)).toBe(false);
  });
});

describe('readReachability', () => {
  it('reads a positive result', () => {
    expect(readReachability({ exists: true })).toBe('reachable');
    expect(readReachability({ data: { isOnWhatsapp: true } })).toBe('reachable');
  });

  it('reads a negative result', () => {
    expect(readReachability({ exists: false })).toBe('unreachable');
  });

  it('returns unknown for a shape it does not recognise', () => {
    // Never 'unreachable': guessing wrong here would silently stop messaging
    // real students because a vendor renamed a key.
    expect(readReachability({ status: 'ok' })).toBe('unknown');
    expect(readReachability(null)).toBe('unknown');
    expect(readReachability('yes')).toBe('unknown');
    expect(readReachability({ exists: 'true' })).toBe('unknown');
  });
});
