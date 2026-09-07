import { CandidateItem, SectionPlan, assembleForm, checkBankReadiness, seededRandom } from './form-assembly.util';

const item = (id: string, areaId: string, difficulty: number, passageId: string | null = null): CandidateItem => ({
  questionId: id,
  questionVersionId: `${id}-v1`,
  areaId,
  difficulty,
  passageId,
});

/** A bank with plenty of everything, so tests isolate the rule under test. */
function bank(areaId: string, n: number, from = 1): CandidateItem[] {
  return Array.from({ length: n }, (_, i) => item(`${areaId}-${from + i}`, areaId, ((from + i) % 5) + 1));
}

const SECTION: SectionPlan = {
  orderIndex: 0,
  questionCount: 4,
  quotas: [{ areaId: 'algebra', count: 4, difficultyCurve: 'ascending' }],
  experimentalSlots: [],
};

describe('seededRandom', () => {
  it('is deterministic for a seed', () => {
    const a = seededRandom('seed-1');
    const b = seededRandom('seed-1');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds', () => {
    expect(seededRandom('a')()).not.toEqual(seededRandom('b')());
  });

  it('stays within [0,1)', () => {
    const rng = seededRandom('range');
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('assembleForm', () => {
  it('fills the quota', () => {
    const res = assembleForm([SECTION], bank('algebra', 20), 'seed');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.items).toHaveLength(4);
  });

  it('produces identical forms for the same seed — acceptance criterion 3', () => {
    const candidates = bank('algebra', 20);
    const a = assembleForm([SECTION], candidates, 'form-3');
    const b = assembleForm([SECTION], candidates, 'form-3');
    expect(a).toEqual(b);
  });

  it('produces different forms for different seeds', () => {
    const candidates = bank('algebra', 40);
    const a = assembleForm([SECTION], candidates, 'form-3');
    const b = assembleForm([SECTION], candidates, 'form-4');
    expect(a).not.toEqual(b);
  });

  it('orders each section easy → hard', () => {
    const candidates = [item('q1', 'algebra', 5), item('q2', 'algebra', 1), item('q3', 'algebra', 3), item('q4', 'algebra', 2)];
    const res = assembleForm([SECTION], candidates, 'seed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const order = res.items.map((i) => candidates.find((c) => c.questionId === i.questionId)!.difficulty);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('never uses the same question twice across sections', () => {
    const two: SectionPlan[] = [
      { ...SECTION, orderIndex: 0 },
      { ...SECTION, orderIndex: 1 },
    ];
    const res = assembleForm(two, bank('algebra', 8), 'seed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.items.map((i) => i.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports a shortfall rather than returning a short form', () => {
    const res = assembleForm([SECTION], bank('algebra', 2), 'seed');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.shortfalls[0]).toMatchObject({ areaId: 'algebra', required: 4, available: 2 });
  });

  it('reports every shortfall in one pass, not just the first', () => {
    const section: SectionPlan = {
      orderIndex: 0,
      questionCount: 8,
      quotas: [
        { areaId: 'algebra', count: 4, difficultyCurve: 'ascending' },
        { areaId: 'geometry', count: 4, difficultyCurve: 'ascending' },
      ],
      experimentalSlots: [],
    };
    const res = assembleForm([section], [...bank('algebra', 1), ...bank('geometry', 2)], 'seed');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.shortfalls).toHaveLength(2);
  });

  it('marks experimental slots unscored', () => {
    const section = { ...SECTION, experimentalSlots: [1, 3] };
    const res = assembleForm([section], bank('algebra', 20), 'seed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items.filter((i) => !i.isScored).map((i) => i.position)).toEqual([1, 3]);
    expect(res.items.filter((i) => i.isScored)).toHaveLength(2);
  });
});

describe('passage grouping — §4.3', () => {
  const passageItems = [
    item('p1-a', 'reading', 2, 'passage-1'),
    item('p1-b', 'reading', 3, 'passage-1'),
    item('p1-c', 'reading', 4, 'passage-1'),
  ];

  it('keeps a passage block together', () => {
    const section: SectionPlan = {
      orderIndex: 0,
      questionCount: 3,
      quotas: [{ areaId: 'reading', count: 3, difficultyCurve: 'ascending' }],
      experimentalSlots: [],
    };
    const res = assembleForm([section], [...passageItems, ...bank('reading', 5, 100)], 'seed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const chosen = res.items.map((i) => i.questionId);
    const fromPassage = chosen.filter((id) => id.startsWith('p1-'));
    // Either the whole block is in, or none of it — never a partial passage.
    expect([0, 3]).toContain(fromPassage.length);
  });

  it('refuses a block that cannot fit the remaining quota rather than splitting it', () => {
    // Quota of 2 with only a 3-item passage available: assembly must fail.
    const section: SectionPlan = {
      orderIndex: 0,
      questionCount: 2,
      quotas: [{ areaId: 'reading', count: 2, difficultyCurve: 'ascending' }],
      experimentalSlots: [],
    };
    const res = assembleForm([section], passageItems, 'seed');
    expect(res.ok).toBe(false);
  });

  it('places a passage block contiguously', () => {
    const section: SectionPlan = {
      orderIndex: 0,
      questionCount: 5,
      quotas: [{ areaId: 'reading', count: 5, difficultyCurve: 'ascending' }],
      experimentalSlots: [],
    };
    const res = assembleForm([section], [...passageItems, item('solo-1', 'reading', 1), item('solo-2', 'reading', 5)], 'seed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const positions = res.items.filter((i) => i.questionId.startsWith('p1-')).map((i) => i.position);
    expect(Math.max(...positions) - Math.min(...positions)).toBe(positions.length - 1);
  });
});

describe('checkBankReadiness — §9', () => {
  it('passes when the bank covers every quota', () => {
    expect(checkBankReadiness([SECTION], bank('algebra', 10)).ready).toBe(true);
  });

  it('names the shortfall per area', () => {
    const res = checkBankReadiness([SECTION], bank('algebra', 3));
    expect(res.ready).toBe(false);
    expect(res.shortfalls[0]).toMatchObject({ areaId: 'algebra', required: 4, available: 3 });
  });

  it('sums demand across sections that share an area', () => {
    // Two sections needing 4 each cannot be served by 5 items, even though
    // either one alone could.
    const two = [{ ...SECTION, orderIndex: 0 }, { ...SECTION, orderIndex: 1 }];
    const res = checkBankReadiness(two, bank('algebra', 5));
    expect(res.ready).toBe(false);
    expect(res.shortfalls[0]).toMatchObject({ required: 8, available: 5 });
  });
});
