import { chooseDailyTest, NudgeCandidate, rotationLength } from './daily-focus.util';

const day = (iso: string) => new Date(`${iso}T09:00:00Z`);
const c = (testId: string, testDate: Date | null = null): NudgeCandidate => ({ testId, testDate });

const MON = day('2026-10-05');
const TUE = day('2026-10-06');
const WED = day('2026-10-07');

describe('chooseDailyTest with nothing to nudge', () => {
  it('returns null rather than inventing an exam', () => {
    expect(chooseDailyTest([], MON)).toBeNull();
  });
});

describe('chooseDailyTest with one exam', () => {
  it('always picks it', () => {
    expect(chooseDailyTest([c('qudurat')], MON)).toBe('qudurat');
    expect(chooseDailyTest([c('qudurat')], TUE)).toBe('qudurat');
  });
});

describe('chooseDailyTest by urgency', () => {
  it('prefers the exam being sat sooner', () => {
    // The bug in miniature: someone sitting a licensing exam in three weeks
    // should not be nudged about قدرات eight months out because قدرات was
    // their first goal.
    const picks = [
      c('qudurat', day('2027-06-01')),
      c('licence', day('2026-10-26')),
    ];
    expect(chooseDailyTest(picks, MON)).toBe('licence');
  });

  it('prefers a dated exam over an undated one', () => {
    expect(chooseDailyTest([c('tahsili'), c('licence', day('2026-11-01'))], MON)).toBe('licence');
  });

  it('treats a passed date as urgent rather than ignoring it', () => {
    // No archive means they have not told us how it went — either they are
    // resitting, or they need prompting to close it off.
    const picks = [c('qudurat', day('2026-09-01')), c('tahsili', day('2027-01-01'))];
    expect(chooseDailyTest(picks, MON)).toBe('qudurat');
  });
});

describe('chooseDailyTest rotation', () => {
  it('alternates between two undated exams across days', () => {
    // Fairness comes from rotating, not from sending more messages.
    const picks = [c('qudurat'), c('tahsili')];
    const monday = chooseDailyTest(picks, MON);
    const tuesday = chooseDailyTest(picks, TUE);
    expect(monday).not.toBe(tuesday);
    // And it comes back round rather than drifting.
    expect(chooseDailyTest(picks, WED)).toBe(monday);
  });

  it('is stable within a day whatever order the candidates arrive in', () => {
    // Two calls on the same day must agree, or planning and sending disagree
    // about which exam the bundle was for.
    const a = [c('qudurat'), c('tahsili')];
    const b = [c('tahsili'), c('qudurat')];
    expect(chooseDailyTest(a, MON)).toBe(chooseDailyTest(b, MON));
  });

  it('rotates among exams tied on the same date', () => {
    const picks = [
      c('qudurat', day('2026-11-01')),
      c('tahsili', day('2026-11-01')),
      c('licence', day('2027-05-01')),
    ];
    const monday = chooseDailyTest(picks, MON);
    const tuesday = chooseDailyTest(picks, TUE);
    expect([monday, tuesday].sort()).toEqual(['qudurat', 'tahsili']);
    // The distant exam never wins while a nearer one is pending.
    expect(monday).not.toBe('licence');
  });

  it('visits every undated exam over a full cycle', () => {
    const picks = [c('a'), c('b'), c('c')];
    const seen = new Set([MON, TUE, WED].map((d) => chooseDailyTest(picks, d)));
    expect(seen.size).toBe(3);
  });
});

describe('rotationLength', () => {
  it('is how many exams share the rotation', () => {
    expect(rotationLength([])).toBe(0);
    expect(rotationLength([c('qudurat')])).toBe(1);
    expect(rotationLength([c('qudurat'), c('tahsili')])).toBe(2);
  });

  it('counts only the exams actually in contention', () => {
    // A distant exam is not part of today's rotation, so promising the
    // learner they will see it tomorrow would be a lie.
    const picks = [
      c('qudurat', day('2026-11-01')),
      c('tahsili', day('2026-11-01')),
      c('licence', day('2027-05-01')),
    ];
    expect(rotationLength(picks)).toBe(2);
  });
});
