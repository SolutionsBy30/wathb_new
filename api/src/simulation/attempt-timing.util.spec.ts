import {
  ABANDON_AFTER_MS,
  ANSWER_GRACE_MS,
  acceptsAnswer,
  AttemptTimingState,
  closeReasonFor,
  isExpired,
  nextAction,
  remainingMs,
  SectionWindow,
  terminalStatus,
} from './attempt-timing.util';

const T0 = new Date('2026-09-07T09:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const SECTION_MS = 25 * MIN;

const win = (over: Partial<SectionWindow> = {}): SectionWindow => ({
  sectionIndex: 0,
  startedAt: T0,
  expiresAt: at(SECTION_MS),
  submittedAt: null,
  lockReason: null,
  ...over,
});

const state = (over: Partial<AttemptTimingState> = {}): AttemptTimingState => ({
  sectionCount: 4,
  sections: [],
  lastActivityAt: T0,
  ...over,
});

describe('remainingMs', () => {
  it('counts down inside the window', () => {
    expect(remainingMs(win(), at(10 * MIN))).toBe(15 * MIN);
  });

  it('floors at zero rather than going negative', () => {
    expect(remainingMs(win(), at(40 * MIN))).toBe(0);
  });

  it('is the full duration at the instant the section starts', () => {
    expect(remainingMs(win(), T0)).toBe(SECTION_MS);
  });
});

describe('acceptsAnswer', () => {
  it('accepts inside the window', () => {
    expect(acceptsAnswer(win(), at(24 * MIN))).toBe(true);
  });

  it('accepts exactly on the deadline', () => {
    expect(acceptsAnswer(win(), at(SECTION_MS))).toBe(true);
  });

  it('accepts within the 5s grace — a slow connection, not a late student', () => {
    expect(acceptsAnswer(win(), at(SECTION_MS + ANSWER_GRACE_MS - 1))).toBe(true);
  });

  it('accepts at the exact end of the grace', () => {
    expect(acceptsAnswer(win(), at(SECTION_MS + ANSWER_GRACE_MS))).toBe(true);
  });

  it('refuses one millisecond past the grace', () => {
    expect(acceptsAnswer(win(), at(SECTION_MS + ANSWER_GRACE_MS + 1))).toBe(false);
  });

  it('refuses a submitted section even inside its window — a replayed request', () => {
    // Acceptance criterion 2: a stale request replayed after "إنهاء القسم"
    // must not reopen a hard-locked section.
    expect(acceptsAnswer(win({ submittedAt: at(5 * MIN), lockReason: 'manual' }), at(6 * MIN))).toBe(false);
  });

  it('refuses a submitted section long after the fact', () => {
    expect(acceptsAnswer(win({ submittedAt: at(5 * MIN), lockReason: 'manual' }), at(90 * MIN))).toBe(false);
  });
});

describe('isExpired / closeReasonFor', () => {
  it('is not expired on the deadline itself', () => {
    expect(isExpired(win(), at(SECTION_MS))).toBe(false);
  });

  it('is expired one millisecond later', () => {
    expect(isExpired(win(), at(SECTION_MS + 1))).toBe(true);
  });

  it('calls an elapsed window a timeout', () => {
    expect(closeReasonFor(win(), at(30 * MIN))).toBe('timeout');
  });

  it('calls a still-open window an abandon', () => {
    expect(closeReasonFor(win(), at(10 * MIN))).toBe('abandon');
  });
});

describe('nextAction', () => {
  it('starts section 0 on a fresh attempt', () => {
    expect(nextAction(state(), at(1))).toEqual({ kind: 'start_section', sectionIndex: 0 });
  });

  it('resumes the open section inside its window', () => {
    const s = state({ sections: [win()], lastActivityAt: at(3 * MIN) });
    expect(nextAction(s, at(10 * MIN))).toEqual({ kind: 'resume', sectionIndex: 0 });
  });

  it('resumes at the same question after ten minutes away, not a reset clock', () => {
    // Acceptance criterion 5. The window is read, never recomputed, so the
    // remaining time reflects the wall clock and not the reconnection.
    const w = win();
    const s = state({ sections: [w], lastActivityAt: T0 });
    expect(nextAction(s, at(10 * MIN))).toEqual({ kind: 'resume', sectionIndex: 0 });
    expect(remainingMs(w, at(10 * MIN))).toBe(15 * MIN);
  });

  it('locks an elapsed section before moving on', () => {
    const s = state({ sections: [win()], lastActivityAt: at(20 * MIN) });
    expect(nextAction(s, at(30 * MIN))).toEqual({ kind: 'lock_section', sectionIndex: 0, reason: 'timeout' });
  });

  it('starts the next section once the previous one is submitted', () => {
    const s = state({
      sections: [win({ submittedAt: at(20 * MIN), lockReason: 'manual' })],
      lastActivityAt: at(20 * MIN),
    });
    expect(nextAction(s, at(21 * MIN))).toEqual({ kind: 'start_section', sectionIndex: 1 });
  });

  it('finalizes as completed when every section has been closed', () => {
    const sections = [0, 1, 2, 3].map((i) =>
      win({ sectionIndex: i, submittedAt: at((i + 1) * 25 * MIN), lockReason: 'manual' }),
    );
    const s = state({ sections, lastActivityAt: at(100 * MIN) });
    expect(nextAction(s, at(101 * MIN))).toEqual({ kind: 'finalize', reason: 'completed' });
  });

  it('abandons after 24h of silence, before touching the section clock', () => {
    const s = state({ sections: [win()], lastActivityAt: T0 });
    expect(nextAction(s, at(ABANDON_AFTER_MS + 1))).toEqual({ kind: 'finalize', reason: 'abandoned' });
  });

  it('does not abandon at exactly 24h', () => {
    const s = state({ sections: [win()], lastActivityAt: T0 });
    expect(nextAction(s, at(ABANDON_AFTER_MS))).toEqual({ kind: 'lock_section', sectionIndex: 0, reason: 'timeout' });
  });

  it('lets a student who returns after twenty hours resume at the next section', () => {
    // §5.4 gives exactly one whole-attempt rule, the 24h one. Twenty hours is
    // not abandonment, so section 2 is still theirs to sit.
    const s = state({
      sections: [win({ submittedAt: at(25 * MIN), lockReason: 'timeout' })],
      lastActivityAt: at(25 * MIN),
    });
    expect(nextAction(s, at(20 * 60 * MIN))).toEqual({ kind: 'start_section', sectionIndex: 1 });
  });

  it('walks sections in index order even when the rows arrive shuffled', () => {
    const sections = [
      win({ sectionIndex: 1, startedAt: at(25 * MIN), expiresAt: at(50 * MIN) }),
      win({ sectionIndex: 0, submittedAt: at(25 * MIN), lockReason: 'manual' }),
    ];
    const s = state({ sections, lastActivityAt: at(26 * MIN) });
    expect(nextAction(s, at(30 * MIN))).toEqual({ kind: 'resume', sectionIndex: 1 });
  });

  it('finalizes a single-section blueprint after its only section closes', () => {
    const s = state({
      sectionCount: 1,
      sections: [win({ submittedAt: at(25 * MIN), lockReason: 'timeout' })],
      lastActivityAt: at(25 * MIN),
    });
    expect(nextAction(s, at(26 * MIN))).toEqual({ kind: 'finalize', reason: 'completed' });
  });
});

describe('terminalStatus', () => {
  const allDone = state({
    sections: [0, 1, 2, 3].map((i) => win({ sectionIndex: i, submittedAt: at(25 * MIN), lockReason: 'manual' })),
  });

  it('is completed when every section was started and closed', () => {
    expect(terminalStatus(allDone, 'walk')).toBe('completed');
  });

  it('is completed even when the last section ran out of time', () => {
    // Running the clock out on section 4 is an ordinary exam ending. Marking
    // it غير مكتمل would stamp a valid sitting as a walk-out.
    const s = state({
      sections: [0, 1, 2, 3].map((i) =>
        win({ sectionIndex: i, submittedAt: at(25 * MIN), lockReason: i === 3 ? 'timeout' : 'manual' }),
      ),
    });
    expect(terminalStatus(s, 'walk')).toBe('completed');
  });

  it('is abandoned whenever the abandon rule fired, however much was done', () => {
    expect(terminalStatus(allDone, 'abandon')).toBe('abandoned');
  });

  it('is expired when sections were never started and it was force-finalized', () => {
    const s = state({ sections: [win({ submittedAt: at(25 * MIN), lockReason: 'timeout' })] });
    expect(terminalStatus(s, 'force')).toBe('expired');
  });

  it('is expired when a section is still open at force-finalize', () => {
    const s = state({ sectionCount: 1, sections: [win()] });
    expect(terminalStatus(s, 'force')).toBe('expired');
  });
});
