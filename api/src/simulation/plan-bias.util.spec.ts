import {
  AreaResult,
  isPlanBiasActive,
  MIN_ITEMS_FOR_BIAS,
  multiplierFor,
  PLAN_BIAS_DAYS,
  PLAN_BIAS_MULTIPLIER,
  planBiasAreas,
  planBiasExpiry,
  planBiasFor,
} from './plan-bias.util';

const T0 = new Date('2026-09-08T10:00:00.000Z');
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

const area = (id: string, accuracy: number, total = 12): AreaResult => ({ areaId: id, accuracy, total });

describe('planBiasAreas', () => {
  it('picks the two weakest areas', () => {
    const areas = [area('geometry', 30), area('algebra', 70), area('reading', 45), area('analogy', 90)];
    expect(planBiasAreas(areas)).toEqual(['geometry', 'reading']);
  });

  it('ignores an area too small to be believed', () => {
    // 0% on three questions is a bad run, not a weakness worth a week.
    const areas = [area('tiny', 0, MIN_ITEMS_FOR_BIAS - 1), area('geometry', 30), area('reading', 45)];
    expect(planBiasAreas(areas)).toEqual(['geometry', 'reading']);
  });

  it('accepts an area at exactly the item floor', () => {
    const areas = [area('small', 10, MIN_ITEMS_FOR_BIAS), area('geometry', 30)];
    expect(planBiasAreas(areas)).toEqual(['small', 'geometry']);
  });

  it('breaks a tie toward the area with more items, so ordering is not arbitrary', () => {
    const areas = [area('few', 40, 5), area('many', 40, 20)];
    expect(planBiasAreas(areas)).toEqual(['many', 'few']);
  });

  it('returns fewer than two when only one area qualifies', () => {
    expect(planBiasAreas([area('only', 20), area('tiny', 0, 1)])).toEqual(['only']);
  });

  it('returns nothing when no area carries enough items', () => {
    expect(planBiasAreas([area('a', 0, 1), area('b', 0, 2)])).toEqual([]);
  });

  it('does not mutate the array it was given', () => {
    const areas = [area('b', 70), area('a', 30)];
    const copy = [...areas];
    planBiasAreas(areas);
    expect(areas).toEqual(copy);
  });
});

describe('isPlanBiasActive', () => {
  it('is active the day after the attempt', () => {
    expect(isPlanBiasActive(T0, days(1))).toBe(true);
  });

  it('is active just before the seven days are up', () => {
    expect(isPlanBiasActive(T0, new Date(days(PLAN_BIAS_DAYS).getTime() - 1))).toBe(true);
  });

  it('has lapsed at exactly seven days', () => {
    expect(isPlanBiasActive(T0, days(PLAN_BIAS_DAYS))).toBe(false);
  });

  it('has lapsed well after', () => {
    expect(isPlanBiasActive(T0, days(30))).toBe(false);
  });

  it('expires seven days after the attempt was finalized', () => {
    expect(planBiasExpiry(T0).toISOString()).toBe(days(PLAN_BIAS_DAYS).toISOString());
  });
});

describe('planBiasFor', () => {
  const areas = [area('geometry', 30), area('algebra', 70), area('reading', 45)];

  it('produces a bias inside the window', () => {
    const bias = planBiasFor(areas, T0, days(2));
    expect(bias).toEqual({
      areaIds: ['geometry', 'reading'],
      multiplier: PLAN_BIAS_MULTIPLIER,
      activeUntil: days(PLAN_BIAS_DAYS),
    });
  });

  it('produces nothing once the window has passed', () => {
    expect(planBiasFor(areas, T0, days(8))).toBeNull();
  });

  it('produces nothing when no area was measured well enough', () => {
    expect(planBiasFor([area('a', 0, 1)], T0, days(1))).toBeNull();
  });
});

describe('multiplierFor', () => {
  const bias = planBiasFor([area('geometry', 30), area('reading', 45), area('algebra', 90)], T0, days(1))!;

  it('lifts a biased area', () => {
    expect(multiplierFor('geometry', bias)).toBe(PLAN_BIAS_MULTIPLIER);
  });

  it('leaves an unbiased area alone', () => {
    expect(multiplierFor('algebra', bias)).toBe(1);
  });

  it('leaves everything alone when there is no bias', () => {
    expect(multiplierFor('geometry', null)).toBe(1);
  });

  it('is a nudge, not a takeover — the multiplier is bounded', () => {
    // §7.5 caps the influence so one bad sitting cannot own the week. If this
    // ever grows past a small factor, that cap has quietly gone.
    expect(PLAN_BIAS_MULTIPLIER).toBeGreaterThan(1);
    expect(PLAN_BIAS_MULTIPLIER).toBeLessThanOrEqual(3);
  });
});
