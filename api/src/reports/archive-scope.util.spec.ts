import {
  archivedTestIds,
  hasFinishedEverything,
  isArchived,
  preparingTestIds,
  StudentTestRow,
  withoutArchived,
} from './archive-scope.util';

const row = (testId: string, isActive: boolean, archivedAt: Date | null = null): StudentTestRow =>
  ({ testId, isActive, archivedAt });

const SAT = new Date('2026-05-01T00:00:00Z');

describe('archivedTestIds', () => {
  it('collects exams the learner has sat', () => {
    expect([...archivedTestIds([row('qudurat', false, SAT), row('licence', true)])]).toEqual(['qudurat']);
  });

  it('counts an archived row even while it is still switched on', () => {
    // The two flags mean different things: switched off is "not practising
    // this right now", archived is "this is over". Archived wins.
    expect([...archivedTestIds([row('qudurat', true, SAT)])]).toEqual(['qudurat']);
  });

  it('is empty when nothing has been sat', () => {
    expect(archivedTestIds([row('qudurat', true), row('licence', false)]).size).toBe(0);
  });
});

describe('preparingTestIds', () => {
  it('is what is switched on and not yet sat', () => {
    const rows = [row('qudurat', true, SAT), row('tahsili', true), row('licence', false)];
    expect([...preparingTestIds(rows)]).toEqual(['tahsili']);
  });

  it('excludes an archived exam even if it was left switched on', () => {
    expect(preparingTestIds([row('qudurat', true, SAT)]).size).toBe(0);
  });
});

describe('withoutArchived', () => {
  const stats = [
    { testId: 'qudurat', nAnswered: 900 },
    { testId: 'licence', nAnswered: 40 },
  ];

  it('drops stats belonging to a sat exam', () => {
    // The whole point: a year of قدرات must not average against six weeks of
    // a licensing exam and describe neither.
    expect(withoutArchived(stats, new Set(['qudurat']))).toEqual([{ testId: 'licence', nAnswered: 40 }]);
  });

  it('returns everything untouched when nothing is archived', () => {
    expect(withoutArchived(stats, new Set())).toBe(stats);
  });

  it('keeps a stat whose test the caller could not resolve', () => {
    // Being unable to resolve a test is not evidence the exam is finished.
    // Dropping these would make a learner's totals fall for no visible reason.
    const orphan = [{ testId: 'deleted-test' }];
    expect(withoutArchived(orphan, new Set(['qudurat']))).toEqual(orphan);
  });

  it('can drop everything, leaving an empty set rather than throwing', () => {
    expect(withoutArchived(stats, new Set(['qudurat', 'licence']))).toEqual([]);
  });
});

describe('hasFinishedEverything', () => {
  it('is true once every enrolled exam has been sat', () => {
    expect(hasFinishedEverything([row('qudurat', false, SAT), row('tahsili', false, SAT)])).toBe(true);
  });

  it('is false while one exam is still being prepared for', () => {
    expect(hasFinishedEverything([row('qudurat', false, SAT), row('licence', true)])).toBe(false);
  });

  it('is false for a learner who has not started', () => {
    // Not started and finished are different states. A school should still see
    // a student who has enrolled in nothing — that is the one worth chasing.
    expect(hasFinishedEverything([])).toBe(false);
    expect(hasFinishedEverything([row('qudurat', false)])).toBe(false);
  });

  it('ignores rows the learner never switched on', () => {
    // Every test in the catalogue gets a row materialised; only the ones they
    // engaged with should decide whether they are done.
    const rows = [row('qudurat', false, SAT), row('never-touched', false)];
    expect(hasFinishedEverything(rows)).toBe(true);
  });
});

describe('isArchived', () => {
  it('reads the timestamp, not a boolean', () => {
    expect(isArchived({ archivedAt: SAT })).toBe(true);
    expect(isArchived({ archivedAt: null })).toBe(false);
  });
});
