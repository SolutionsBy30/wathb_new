import { isStrength, isUnderSampled, labelScore, recencyPenalty, sectionScore, selectLabelsForBundle, selectSectionForDay } from './selection-engine';
import { DEFAULT_SELECTION_CONFIG, LabelState, SectionState, SelectionConfig } from './selection-engine.types';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function label(overrides: Partial<LabelState>): LabelState {
  return {
    labelId: 'l',
    sectionId: 's',
    accuracy: 0.5,
    nAnswered: 0,
    lastServedDaysAgo: null,
    curriculumWeight: 1,
    difficultyLevel: 3,
    ...overrides,
  };
}

function section(overrides: Partial<SectionState>): SectionState {
  return { sectionId: 'sec', accuracy: 0.5, nAnswered: 0, lastServedDaysAgo: null, ...overrides };
}

describe('recencyPenalty', () => {
  it('heavily decays a label served today', () => {
    expect(recencyPenalty(0)).toBeLessThan(recencyPenalty(1));
    expect(recencyPenalty(1)).toBeLessThan(recencyPenalty(2));
    expect(recencyPenalty(2)).toBe(1);
    expect(recencyPenalty(null)).toBe(1);
  });
});

describe('labelScore', () => {
  it('gives cold-start (never answered) labels a coverage-driven score, not zero', () => {
    const cold = label({ labelId: 'cold', nAnswered: 0, accuracy: 0.5 });
    expect(labelScore(cold, 20)).toBeCloseTo(1, 5); // coverage_weight=1, confidence=0
  });

  it('weights a low-accuracy, well-sampled label higher than a high-accuracy one', () => {
    const weak = label({ labelId: 'weak', nAnswered: 40, accuracy: 0.3 });
    const strong = label({ labelId: 'strong', nAnswered: 40, accuracy: 0.9 });
    expect(labelScore(weak, 20)).toBeGreaterThan(labelScore(strong, 20));
  });

  it('applies curriculum weight as a multiplier', () => {
    const base = label({ nAnswered: 40, accuracy: 0.3 });
    const heavy = { ...base, curriculumWeight: 2 };
    expect(labelScore(heavy, 20)).toBeCloseTo(labelScore(base, 20) * 2, 5);
  });
});

describe('isStrength / isUnderSampled', () => {
  const cfg: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, rng: Math.random };

  it('requires both high accuracy and sufficient confidence for strength', () => {
    expect(isStrength(label({ accuracy: 0.9, nAnswered: 2 }), cfg)).toBe(false); // low confidence
    expect(isStrength(label({ accuracy: 0.9, nAnswered: 15 }), cfg)).toBe(true);
    expect(isStrength(label({ accuracy: 0.5, nAnswered: 15 }), cfg)).toBe(false);
  });

  it('flags labels below the under-sampled threshold', () => {
    expect(isUnderSampled(label({ nAnswered: 2 }), cfg)).toBe(true);
    expect(isUnderSampled(label({ nAnswered: 10 }), cfg)).toBe(false);
  });
});

describe('selectLabelsForBundle', () => {
  const labels: LabelState[] = [
    label({ labelId: 'weak-verbal', accuracy: 0.3, nAnswered: 40 }),
    label({ labelId: 'strong-verbal', accuracy: 0.9, nAnswered: 40 }),
    label({ labelId: 'new-label', accuracy: 0.5, nAnswered: 0 }),
    label({ labelId: 'mid-quant', accuracy: 0.55, nAnswered: 30 }),
    label({ labelId: 'mid-quant-2', accuracy: 0.6, nAnswered: 25 }),
  ];

  it('returns exactly bundleSize picks when enough labels exist', () => {
    const picks = selectLabelsForBundle(labels, { rng: seededRng(1) });
    expect(picks).toHaveLength(5);
  });

  it('never exceeds maxPerLabel for a single label', () => {
    const picks = selectLabelsForBundle(labels, { rng: seededRng(7), bundleSize: 20, maxPerLabel: 3 });
    const counts = new Map<string, number>();
    for (const p of picks) counts.set(p.labelId, (counts.get(p.labelId) ?? 0) + 1);
    for (const c of counts.values()) expect(c).toBeLessThanOrEqual(3);
  });

  it('guarantees at least one strength-label question when a strength label exists', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const picks = selectLabelsForBundle(labels, { rng: seededRng(seed) });
      expect(picks.some((p) => p.labelId === 'strong-verbal')).toBe(true);
    }
  });

  it('guarantees at least one under-sampled label question when one exists', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const picks = selectLabelsForBundle(labels, { rng: seededRng(seed) });
      expect(picks.some((p) => p.labelId === 'new-label')).toBe(true);
    }
  });

  it('clamps target difficulty to 1..5', () => {
    const extreme = [label({ labelId: 'lo', difficultyLevel: -3 }), label({ labelId: 'hi', difficultyLevel: 9 })];
    const picks = selectLabelsForBundle(extreme, { rng: seededRng(3), bundleSize: 2, maxPerLabel: 1 });
    for (const p of picks) {
      expect(p.targetDifficulty).toBeGreaterThanOrEqual(1);
      expect(p.targetDifficulty).toBeLessThanOrEqual(5);
    }
  });

  it('is a no-op on an empty label set', () => {
    expect(selectLabelsForBundle([])).toEqual([]);
  });
});

describe('sectionScore', () => {
  it('weights a weak, well-sampled section higher than a strong one', () => {
    const weak = section({ sectionId: 'weak', accuracy: 0.3, nAnswered: 100 });
    const strong = section({ sectionId: 'strong', accuracy: 0.9, nAnswered: 100 });
    expect(sectionScore(weak, 20)).toBeGreaterThan(sectionScore(strong, 20));
  });

  it('heavily penalizes a section served today, pushing rotation', () => {
    const seenToday = section({ accuracy: 0.3, nAnswered: 100, lastServedDaysAgo: 0 });
    const seenLongAgo = section({ accuracy: 0.3, nAnswered: 100, lastServedDaysAgo: 30 });
    expect(sectionScore(seenToday, 20)).toBeLessThan(sectionScore(seenLongAgo, 20));
  });
});

describe('selectSectionForDay', () => {
  it('returns null for an empty section list', () => {
    expect(selectSectionForDay([])).toBeNull();
  });

  it('returns the only section when there is just one', () => {
    expect(selectSectionForDay([section({ sectionId: 'only' })])).toBe('only');
  });

  it('favors the weakest section across repeated draws', () => {
    const sections = [
      section({ sectionId: 'weak', accuracy: 0.3, nAnswered: 100 }),
      section({ sectionId: 'strong', accuracy: 0.9, nAnswered: 100 }),
    ];
    let weakCount = 0;
    for (let seed = 1; seed <= 50; seed++) {
      if (selectSectionForDay(sections, { rng: seededRng(seed) }) === 'weak') weakCount += 1;
    }
    expect(weakCount).toBeGreaterThan(35); // clearly favored, not a coin flip
  });

  it('never picks a section not in the input list', () => {
    const sections = [section({ sectionId: 'a' }), section({ sectionId: 'b' }), section({ sectionId: 'c' })];
    for (let seed = 1; seed <= 20; seed++) {
      const picked = selectSectionForDay(sections, { rng: seededRng(seed) });
      expect(['a', 'b', 'c']).toContain(picked);
    }
  });
});
