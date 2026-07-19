import { accuracyBand, compositeDelta, pickTopStrengthWeakness, speedBand } from './weekly-report.util';

describe('accuracyBand', () => {
  it('buckets correctly', () => {
    expect(accuracyBand(0.3)).toBe('low');
    expect(accuracyBand(0.6)).toBe('mid');
    expect(accuracyBand(0.9)).toBe('high');
  });
});

describe('speedBand', () => {
  it('flags slow when well over target', () => {
    expect(speedBand(60, 40)).toBe('slow');
  });
  it('flags fast when well under target', () => {
    expect(speedBand(20, 40)).toBe('fast');
  });
  it('is on_pace within the tolerance band', () => {
    expect(speedBand(42, 40)).toBe('on_pace');
  });
});

function label(overrides: Partial<{ labelId: string; nAnswered: number; nCorrect: number }> = {}) {
  return {
    labelId: overrides.labelId ?? 'l',
    nameAr: 'تصنيف',
    nAnswered: overrides.nAnswered ?? 25,
    nCorrect: overrides.nCorrect ?? 15,
    meanTimeMs: 30000,
    targetTimeS: 40,
  };
}

describe('pickTopStrengthWeakness', () => {
  it('excludes labels below MIN_SAMPLE', () => {
    const labels = [label({ labelId: 'thin', nAnswered: 3, nCorrect: 3 }), label({ labelId: 'ok', nAnswered: 25, nCorrect: 20 })];
    const { strength, weakness } = pickTopStrengthWeakness(labels, 20);
    expect(strength?.labelId).toBe('ok');
    expect(weakness?.labelId).toBe('ok');
  });

  it('picks the highest and lowest accuracy among reportable labels', () => {
    const labels = [
      label({ labelId: 'weak', nAnswered: 25, nCorrect: 5 }),
      label({ labelId: 'mid', nAnswered: 25, nCorrect: 15 }),
      label({ labelId: 'strong', nAnswered: 25, nCorrect: 23 }),
    ];
    const { strength, weakness } = pickTopStrengthWeakness(labels, 20);
    expect(strength?.labelId).toBe('strong');
    expect(weakness?.labelId).toBe('weak');
  });

  it('returns nulls when nothing clears MIN_SAMPLE', () => {
    const labels = [label({ nAnswered: 2 })];
    expect(pickTopStrengthWeakness(labels, 20)).toEqual({ strength: null, weakness: null });
  });
});

describe('compositeDelta', () => {
  it('is null with fewer than two weeks of data', () => {
    expect(compositeDelta([{ weekStart: 'w1', accuracy: 0.5 }])).toBeNull();
    expect(compositeDelta([])).toBeNull();
  });

  it('subtracts the prior week from the latest', () => {
    const trend = [
      { weekStart: 'w1', accuracy: 0.5 },
      { weekStart: 'w2', accuracy: 0.6 },
    ];
    expect(compositeDelta(trend)).toBeCloseTo(0.1);
  });

  it('skips weeks with no data when finding the latest two with data', () => {
    const trend = [
      { weekStart: 'w1', accuracy: 0.5 },
      { weekStart: 'w2', accuracy: 0.6 },
      { weekStart: 'w3', accuracy: null },
    ];
    expect(compositeDelta(trend)).toBeCloseTo(0.1);
  });
});
