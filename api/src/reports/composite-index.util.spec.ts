import { computeCompositeIndex, LabelStatForComposite } from './composite-index.util';

function stat(overrides: Partial<LabelStatForComposite>): LabelStatForComposite {
  return { nAnswered: 30, nCorrect: 15, areaId: 'a1', sectionWeight: 1, ...overrides };
}

describe('computeCompositeIndex', () => {
  it('returns null when there is no data', () => {
    expect(computeCompositeIndex([], 20)).toBeNull();
  });

  it('returns null when every area is below the sample floor', () => {
    const stats = [stat({ areaId: 'a1', nAnswered: 5, nCorrect: 3 })];
    expect(computeCompositeIndex(stats, 20)).toBeNull();
  });

  it('equals a single reportable area\'s own accuracy, rounded to a 0-100 scale', () => {
    const stats = [stat({ areaId: 'a1', nAnswered: 40, nCorrect: 30, sectionWeight: 1 })];
    expect(computeCompositeIndex(stats, 20)).toBe(75);
  });

  it('sums multiple labels within the same area before applying the floor', () => {
    const stats = [
      stat({ areaId: 'a1', nAnswered: 12, nCorrect: 6 }),
      stat({ areaId: 'a1', nAnswered: 12, nCorrect: 9 }),
    ];
    // combined: 15/24 = 62.5% -> rounds to 63, and clears the 20-sample floor
    // only once combined (12 alone would not).
    expect(computeCompositeIndex(stats, 20)).toBe(63);
  });

  it('weights areas by section weight, not evenly', () => {
    const heavyWeak = stat({ areaId: 'weak', nAnswered: 40, nCorrect: 8, sectionWeight: 3 }); // 20%
    const lightStrong = stat({ areaId: 'strong', nAnswered: 40, nCorrect: 36, sectionWeight: 1 }); // 90%
    // weighted: (0.2*3 + 0.9*1) / 4 = 1.5/4 = 37.5% -> 38
    expect(computeCompositeIndex([heavyWeak, lightStrong], 20)).toBe(38);
    // an unweighted (simple) average would have been 55%, clearly different.
  });

  it('excludes a zero-weight area entirely rather than dividing by it', () => {
    const zeroWeight = stat({ areaId: 'zero', nAnswered: 40, nCorrect: 0, sectionWeight: 0 });
    const normal = stat({ areaId: 'normal', nAnswered: 40, nCorrect: 20, sectionWeight: 1 });
    expect(computeCompositeIndex([zeroWeight, normal], 20)).toBe(50);
  });
});
