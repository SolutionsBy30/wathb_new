import {
  applyScoringProfile,
  difficultyBand,
  ScoredAnswer,
  SectionMeta,
  scoreAttempt,
} from './scoring.util';

const ans = (over: Partial<ScoredAnswer> = {}): ScoredAnswer => ({
  sectionIndex: 0,
  position: 0,
  areaId: 'verbal-analogy',
  areaNameAr: 'التناظر اللفظي',
  difficulty: 3,
  isScored: true,
  selectedKey: 'a',
  isCorrect: true,
  timeSpentMs: 30_000,
  flagged: false,
  ...over,
});

const sections: SectionMeta[] = [
  { sectionIndex: 0, part: 'verbal', timedOut: false },
  { sectionIndex: 1, part: 'quantitative', timedOut: false },
];

describe('difficultyBand', () => {
  it('maps the authored 1..5 onto three bands', () => {
    expect([1, 2, 3, 4, 5].map(difficultyBand)).toEqual(['easy', 'easy', 'medium', 'hard', 'hard']);
  });
});

describe('scoreAttempt', () => {
  it('counts only correct scored answers toward the raw score', () => {
    const r = scoreAttempt([ans(), ans({ isCorrect: false }), ans()], sections);
    expect(r.rawScore).toBe(2);
    expect(r.scoredCount).toBe(3);
  });

  it('excludes experimental items from the raw score and reports them apart', () => {
    // Acceptance criterion 4: excluded from every score surface, present in
    // statistics.
    const r = scoreAttempt(
      [ans(), ans({ isScored: false }), ans({ isScored: false, isCorrect: false })],
      sections,
    );
    expect(r.rawScore).toBe(1);
    expect(r.scoredCount).toBe(1);
    expect(r.experimental).toEqual({ total: 2, correct: 1 });
  });

  it('keeps experimental items out of the area breakdown too', () => {
    const r = scoreAttempt(
      [ans({ areaId: 'a', areaNameAr: 'أ' }), ans({ areaId: 'b', areaNameAr: 'ب', isScored: false })],
      sections,
    );
    expect(r.areaBreakdown.map((a) => a.areaId)).toEqual(['a']);
  });

  it('treats an unanswered item as wrong for the score but reports it separately', () => {
    const r = scoreAttempt([ans(), ans({ selectedKey: null, isCorrect: null })], sections);
    expect(r.rawScore).toBe(1);
    expect(r.accuracy).toBe(50);
    expect(r.areaBreakdown[0]).toMatchObject({ total: 2, correct: 1, wrong: 0, unanswered: 1 });
  });

  it('splits verbal and quantitative by the section they sit in', () => {
    const r = scoreAttempt(
      [
        ans({ sectionIndex: 0 }),
        ans({ sectionIndex: 0, isCorrect: false }),
        ans({ sectionIndex: 1 }),
        ans({ sectionIndex: 1 }),
      ],
      sections,
    );
    expect(r.verbalEstimate).toBe(50);
    expect(r.quantEstimate).toBe(100);
  });

  it('returns null, not zero, for a part the blueprint does not have', () => {
    // A تحصيلي blueprint has no verbal/quantitative split; 0% would read as
    // "got everything wrong" rather than "not applicable".
    const r = scoreAttempt([ans({ sectionIndex: 0 })], [{ sectionIndex: 0, part: 'mixed', timedOut: false }]);
    expect(r.verbalEstimate).toBeNull();
    expect(r.quantEstimate).toBeNull();
  });

  it('sorts the area breakdown weakest first, which is what the report leads with', () => {
    const r = scoreAttempt(
      [
        ans({ areaId: 'strong', areaNameAr: 'قوي' }),
        ans({ areaId: 'strong', areaNameAr: 'قوي' }),
        ans({ areaId: 'weak', areaNameAr: 'ضعيف', isCorrect: false }),
        ans({ areaId: 'weak', areaNameAr: 'ضعيف', isCorrect: false }),
      ],
      sections,
    );
    expect(r.areaBreakdown.map((a) => a.areaId)).toEqual(['weak', 'strong']);
    expect(r.areaBreakdown[0].accuracy).toBe(0);
  });

  it('reports mean time per area', () => {
    const r = scoreAttempt([ans({ timeSpentMs: 10_000 }), ans({ timeSpentMs: 20_000 })], sections);
    expect(r.areaBreakdown[0].meanTimeMs).toBe(15_000);
  });

  it('marks a section that ran out of time', () => {
    const r = scoreAttempt([ans({ sectionIndex: 1 })], [
      { sectionIndex: 0, part: 'verbal', timedOut: false },
      { sectionIndex: 1, part: 'quantitative', timedOut: true },
    ]);
    expect(r.sectionBreakdown.find((s) => s.sectionIndex === 1)!.timedOut).toBe(true);
  });

  it('lists a section the student never reached with zeros rather than omitting it', () => {
    const r = scoreAttempt([ans({ sectionIndex: 0 })], sections);
    const s1 = r.sectionBreakdown.find((s) => s.sectionIndex === 1)!;
    expect(s1).toMatchObject({ total: 0, correct: 0, accuracy: 0 });
  });

  describe('pacing', () => {
    it('counts answers under 10s as rushed', () => {
      const r = scoreAttempt([ans({ timeSpentMs: 9_999 }), ans({ timeSpentMs: 10_000 })], sections);
      expect(r.pacing.rushedCount).toBe(1);
    });

    it('counts answers over 90s as time sinks', () => {
      const r = scoreAttempt([ans({ timeSpentMs: 90_001 }), ans({ timeSpentMs: 90_000 })], sections);
      expect(r.pacing.timeSinkCount).toBe(1);
    });

    it('excludes unanswered items from rushed, sinks and mean time', () => {
      // An unanswered item carries whatever time was spent looking at it;
      // folding that into "how fast do you answer" measures nothing.
      const r = scoreAttempt(
        [ans({ timeSpentMs: 20_000 }), ans({ selectedKey: null, isCorrect: null, timeSpentMs: 1_000 })],
        sections,
      );
      expect(r.pacing.rushedCount).toBe(0);
      expect(r.pacing.meanTimeMs).toBe(20_000);
      expect(r.pacing.unansweredCount).toBe(1);
    });

    it('reports zero mean time rather than dividing by zero on an empty attempt', () => {
      const r = scoreAttempt([], sections);
      expect(r.pacing.meanTimeMs).toBe(0);
      expect(r.accuracy).toBe(0);
    });

    it('breaks accuracy down by difficulty band', () => {
      const r = scoreAttempt(
        [ans({ difficulty: 1 }), ans({ difficulty: 5, isCorrect: false }), ans({ difficulty: 5, isCorrect: false })],
        sections,
      );
      expect(r.pacing.difficultyBands).toEqual([
        { band: 'easy', total: 1, correct: 1, accuracy: 100 },
        { band: 'medium', total: 0, correct: 0, accuracy: 0 },
        { band: 'hard', total: 2, correct: 0, accuracy: 0 },
      ]);
    });

    it('finds the collapse point when accuracy falls away from the student own baseline', () => {
      const answers = [
        ...Array.from({ length: 4 }, () => ans({ sectionIndex: 0 })),
        ...Array.from({ length: 4 }, () => ans({ sectionIndex: 1, isCorrect: false })),
      ];
      const r = scoreAttempt(answers, sections);
      expect(r.pacing.collapseSectionIndex).toBe(1);
    });

    it('does not call a consistently low scorer a collapse', () => {
      // 45% then 40% is not a fade; an absolute threshold would flag it.
      const s0 = [
        ...Array.from({ length: 5 }, () => ans({ sectionIndex: 0 })),
        ...Array.from({ length: 5 }, () => ans({ sectionIndex: 0, isCorrect: false })),
      ];
      const s1 = [
        ...Array.from({ length: 4 }, () => ans({ sectionIndex: 1 })),
        ...Array.from({ length: 6 }, () => ans({ sectionIndex: 1, isCorrect: false })),
      ];
      expect(scoreAttempt([...s0, ...s1], sections).pacing.collapseSectionIndex).toBeNull();
    });

    it('reports no collapse when only one section was sat', () => {
      const r = scoreAttempt([ans({ sectionIndex: 0 })], sections);
      expect(r.pacing.collapseSectionIndex).toBeNull();
    });

    it('carries the screen-exit count through', () => {
      expect(scoreAttempt([ans()], sections, 3).pacing.screenExits).toBe(3);
    });
  });
});

describe('applyScoringProfile', () => {
  it('maps a raw score through the table', () => {
    expect(applyScoringProfile(72, { 71: 76, 72: 78, 73: 79 })).toBe(78);
  });

  it('returns null when no profile exists — §12.1 is unresolved', () => {
    expect(applyScoringProfile(72, null)).toBeNull();
    expect(applyScoringProfile(72, undefined)).toBeNull();
  });

  it('returns null for a raw score the table does not cover, rather than guessing', () => {
    expect(applyScoringProfile(96, { 71: 76 })).toBeNull();
  });

  it('refuses a non-numeric table entry', () => {
    expect(applyScoringProfile(72, { 72: 'ممتاز' })).toBeNull();
  });
});
