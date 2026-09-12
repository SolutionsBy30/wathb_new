import {
  aliasFor,
  canRevealIdentity,
  DEFAULT_BANDS,
  isReportable,
  MIN_ANSWERS_FOR_BAND,
  MIN_COHORT_STUDENTS,
  readinessBand,
  StudentRow,
  summarise,
} from './school-insights.util';

const privacy = (over: Partial<{ optedOutAt: Date | null; consentedAt: Date | null }> = {}) => ({
  studentId: 's1',
  optedOutAt: null,
  consentedAt: null,
  ...over,
});

const NOW = new Date('2026-09-12T00:00:00.000Z');

describe('canRevealIdentity', () => {
  it('hides names when the school has no disclosure', () => {
    expect(canRevealIdentity('none', privacy())).toBe(false);
    expect(canRevealIdentity('none', privacy({ consentedAt: NOW }))).toBe(false);
  });

  it('shows names to a fully disclosed school', () => {
    expect(canRevealIdentity('full', privacy())).toBe(true);
  });

  it('shows only consenting students under consented disclosure', () => {
    expect(canRevealIdentity('consented', privacy({ consentedAt: NOW }))).toBe(true);
    expect(canRevealIdentity('consented', privacy())).toBe(false);
  });

  it('lets the student veto even a fully disclosed school', () => {
    // The narrower decision has to win, or the opt-out is decorative.
    expect(canRevealIdentity('full', privacy({ optedOutAt: NOW }))).toBe(false);
  });

  it('lets an opt-out override an earlier consent', () => {
    expect(canRevealIdentity('consented', privacy({ consentedAt: NOW, optedOutAt: NOW }))).toBe(false);
  });
});

describe('aliasFor', () => {
  it('is stable for the same student at the same school', () => {
    expect(aliasFor('stu-1', 'school-a')).toBe(aliasFor('stu-1', 'school-a'));
  });

  it('differs between students', () => {
    expect(aliasFor('stu-1', 'school-a')).not.toBe(aliasFor('stu-2', 'school-a'));
  });

  it('gives the same student a different alias at a different school', () => {
    // Otherwise two schools could re-identify a shared student by matching
    // codes.
    expect(aliasFor('stu-1', 'school-a')).not.toBe(aliasFor('stu-1', 'school-b'));
  });

  it('does not contain the student id', () => {
    const id = 'abcdef12-3456-7890-abcd-ef1234567890';
    expect(aliasFor(id, 'school-a')).not.toContain(id.slice(0, 8));
  });

  it('is short enough to say out loud', () => {
    expect(aliasFor('stu-1', 'school-a').length).toBeLessThanOrEqual(12);
  });

  it('rarely collides within one school', () => {
    const aliases = new Set(Array.from({ length: 500 }, (_, i) => aliasFor(`stu-${i}`, 'school-a')));
    expect(aliases.size).toBeGreaterThan(490);
  });
});

describe('isReportable', () => {
  it('refuses a cohort below the floor', () => {
    expect(isReportable(MIN_COHORT_STUDENTS - 1)).toBe(false);
  });

  it('allows the cohort at the floor', () => {
    expect(isReportable(MIN_COHORT_STUDENTS)).toBe(true);
  });

  it('honours a tighter floor for per-area rows', () => {
    expect(isReportable(6, 5)).toBe(true);
    expect(isReportable(4, 5)).toBe(false);
  });
});

describe('readinessBand', () => {
  const enough = MIN_ANSWERS_FOR_BAND;

  it('refuses to band a student with too little data', () => {
    // Nine answers is unmeasured, not "at risk" — banding it would put a
    // student in a support class on noise.
    expect(readinessBand(20, 9)).toBe('insufficient');
    expect(readinessBand(null, 500)).toBe('insufficient');
  });

  it('bands at exactly the answer floor', () => {
    expect(readinessBand(90, enough)).toBe('strong');
  });

  it('maps accuracy onto the four bands', () => {
    expect(readinessBand(85, enough)).toBe('strong');
    expect(readinessBand(80, enough)).toBe('strong');
    expect(readinessBand(79.9, enough)).toBe('on_track');
    expect(readinessBand(65, enough)).toBe('on_track');
    expect(readinessBand(64.9, enough)).toBe('needs_support');
    expect(readinessBand(50, enough)).toBe('needs_support');
    expect(readinessBand(49.9, enough)).toBe('at_risk');
    expect(readinessBand(0, enough)).toBe('at_risk');
  });

  it('honours a school with different thresholds', () => {
    const strict = { strong: 90, onTrack: 80, needsSupport: 70 };
    expect(readinessBand(85, enough, strict)).toBe('on_track');
    expect(readinessBand(85, enough, DEFAULT_BANDS)).toBe('strong');
  });
});

describe('summarise', () => {
  const row = (over: Partial<StudentRow> = {}): StudentRow => ({
    studentId: 's',
    accuracy: 70,
    answered: 100,
    completedLeaps: 20,
    lastActiveAt: NOW,
    simulationAccuracy: null,
    ...over,
  });

  it('counts every student, including the unmeasured', () => {
    const s = summarise([row(), row({ accuracy: null, answered: 0 })]);
    expect(s.students).toBe(2);
    expect(s.measured).toBe(1);
  });

  it('keeps unmeasured students out of the mean rather than scoring them zero', () => {
    // Folding a null in as zero would turn a participation problem into an
    // apparent ability problem.
    const s = summarise([row({ accuracy: 80 }), row({ accuracy: null, answered: 0 })]);
    expect(s.meanAccuracy).toBe(80);
  });

  it('puts an unmeasured student in their own band', () => {
    const s = summarise([row({ accuracy: null, answered: 0 })]);
    expect(s.bands.insufficient).toBe(1);
    expect(s.bands.at_risk).toBe(0);
  });

  it('computes a median over an even count', () => {
    const s = summarise([row({ accuracy: 60 }), row({ accuracy: 80 })]);
    expect(s.medianAccuracy).toBe(70);
  });

  it('computes a median over an odd count', () => {
    const s = summarise([row({ accuracy: 50 }), row({ accuracy: 60 }), row({ accuracy: 90 })]);
    expect(s.medianAccuracy).toBe(60);
  });

  it('returns nulls rather than zeros for an entirely unmeasured school', () => {
    const s = summarise([row({ accuracy: null, answered: 0 }), row({ accuracy: null, answered: 0 })]);
    expect(s.meanAccuracy).toBeNull();
    expect(s.medianAccuracy).toBeNull();
  });

  it('handles an empty school', () => {
    expect(summarise([])).toMatchObject({ students: 0, measured: 0, meanAccuracy: null });
  });

  it('counts the bands a school would act on', () => {
    const s = summarise([
      row({ accuracy: 90 }),
      row({ accuracy: 70 }),
      row({ accuracy: 55 }),
      row({ accuracy: 30 }),
      row({ accuracy: 95, answered: 5 }),
    ]);
    expect(s.bands).toEqual({ strong: 1, on_track: 1, needs_support: 1, at_risk: 1, insufficient: 1 });
  });
});
