import { BlueprintInput, SectionInput, validateBlueprint } from './blueprint-validation.util';

const section = (over: Partial<SectionInput> = {}): SectionInput => ({
  orderIndex: 0,
  part: 'verbal',
  questionCount: 24,
  durationS: 1500,
  experimentalSlots: [],
  quotas: [{ areaId: 'a1', count: 24, difficultyCurve: 'ascending' }],
  ...over,
});

/** The Qudurat محوسب shape from §3.1: 4 × 24 = 96, one experimental per section. */
const qudurat = (): BlueprintInput => ({
  totalQuestions: 96,
  sectionCount: 4,
  experimentalCount: 4,
  sections: [0, 1, 2, 3].map((i) =>
    section({
      orderIndex: i,
      part: i % 2 === 0 ? 'verbal' : 'quantitative',
      experimentalSlots: [23],
      quotas: [
        { areaId: `a${i}-1`, count: 12, difficultyCurve: 'ascending' },
        { areaId: `a${i}-2`, count: 12, difficultyCurve: 'ascending' },
      ],
    }),
  ),
});

const codes = (bp: BlueprintInput) => validateBlueprint(bp).map((i) => i.code);

describe('validateBlueprint', () => {
  it('accepts the Qudurat محوسب blueprint', () => {
    expect(validateBlueprint(qudurat())).toEqual([]);
  });

  it('reports a blueprint with no sections and stops there', () => {
    const issues = validateBlueprint({ totalQuestions: 96, sectionCount: 4, experimentalCount: 4, sections: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('no_sections');
  });

  it('catches a declared section count that does not match the sections', () => {
    const bp = qudurat();
    bp.sectionCount = 5;
    expect(codes(bp)).toContain('section_count_mismatch');
  });

  it('catches a gap in the order indexes', () => {
    const bp = qudurat();
    bp.sections[3].orderIndex = 7;
    expect(codes(bp)).toContain('order_index_invalid');
  });

  it('catches duplicated order indexes', () => {
    const bp = qudurat();
    bp.sections[3].orderIndex = 2;
    expect(codes(bp)).toContain('order_index_invalid');
  });

  it('catches sections that do not sum to the declared total', () => {
    const bp = qudurat();
    bp.totalQuestions = 100;
    expect(codes(bp)).toContain('total_questions_mismatch');
  });

  it('catches quotas that do not sum to the section question count', () => {
    const bp = qudurat();
    bp.sections[1].quotas[0].count = 11;
    const issues = validateBlueprint(bp);
    expect(issues.some((i) => i.code === 'quota_sum_mismatch' && i.sectionIndex === 1)).toBe(true);
  });

  it('catches a zero or negative quota', () => {
    const bp = qudurat();
    bp.sections[0].quotas = [
      { areaId: 'a', count: 24, difficultyCurve: 'ascending' },
      { areaId: 'b', count: 0, difficultyCurve: 'ascending' },
    ];
    expect(codes(bp)).toContain('quota_not_positive');
  });

  it('catches a repeated area within one section', () => {
    const bp = qudurat();
    bp.sections[0].quotas = [
      { areaId: 'same', count: 12, difficultyCurve: 'ascending' },
      { areaId: 'same', count: 12, difficultyCurve: 'ascending' },
    ];
    expect(codes(bp)).toContain('duplicate_area');
  });

  it('catches a section with no quotas at all', () => {
    const bp = qudurat();
    bp.sections[2].quotas = [];
    const issues = validateBlueprint(bp);
    expect(issues.some((i) => i.code === 'no_quotas' && i.sectionIndex === 2)).toBe(true);
  });

  it('does not also report a quota sum mismatch when there are no quotas', () => {
    const bp = qudurat();
    bp.sections[2].quotas = [];
    expect(codes(bp)).not.toContain('quota_sum_mismatch');
  });

  it('catches an experimental slot past the end of the section', () => {
    const bp = qudurat();
    bp.sections[0].experimentalSlots = [30];
    expect(codes(bp)).toContain('slot_out_of_range');
  });

  it('catches a negative experimental slot', () => {
    const bp = qudurat();
    bp.sections[0].experimentalSlots = [-1];
    expect(codes(bp)).toContain('slot_out_of_range');
  });

  it('catches a repeated experimental slot', () => {
    const bp = qudurat();
    bp.sections[0].experimentalSlots = [10, 10];
    bp.experimentalCount = 4;
    expect(codes(bp)).toContain('duplicate_slot');
  });

  it('counts a repeated slot once toward the experimental total', () => {
    const bp = qudurat();
    // Someone padded the count by listing position 10 twice. The form still
    // holds four experimental items, one per section — not five.
    bp.sections[0].experimentalSlots = [10, 10];
    bp.experimentalCount = 5;
    expect(codes(bp)).toContain('experimental_count_mismatch');
  });

  it('catches a declared experimental count with no slots to back it', () => {
    const bp = qudurat();
    bp.sections.forEach((s) => { s.experimentalSlots = []; });
    expect(codes(bp)).toContain('experimental_count_mismatch');
  });

  it('catches a zero section duration', () => {
    const bp = qudurat();
    bp.sections[1].durationS = 0;
    const issues = validateBlueprint(bp);
    expect(issues.some((i) => i.code === 'duration_not_positive' && i.sectionIndex === 1)).toBe(true);
  });

  it('catches an unknown part', () => {
    const bp = qudurat();
    bp.sections[0].part = 'listening';
    expect(codes(bp)).toContain('part_invalid');
  });

  it('reports every failure in one pass rather than the first', () => {
    const bp = qudurat();
    bp.totalQuestions = 100;
    bp.sections[0].durationS = 0;
    bp.sections[1].quotas[0].count = 11;
    bp.sections[2].part = 'nonsense';
    const found = codes(bp);
    expect(found).toEqual(
      expect.arrayContaining(['total_questions_mismatch', 'duration_not_positive', 'quota_sum_mismatch', 'part_invalid']),
    );
  });

  it('accepts a single-section blueprint (a different test shape, §11)', () => {
    const bp: BlueprintInput = {
      totalQuestions: 40,
      sectionCount: 1,
      experimentalCount: 0,
      sections: [section({ questionCount: 40, quotas: [{ areaId: 'x', count: 40, difficultyCurve: 'none' }] })],
    };
    expect(validateBlueprint(bp)).toEqual([]);
  });
});
