/**
 * SIM-007 — §5.1/§5.4 runtime timing, as a pure function over section windows.
 *
 * Acceptance criterion 2: "section lock cannot be bypassed by client
 * manipulation, tab close, clock change, or replay of a stale request." That
 * makes every decision here server-side by construction — the client clock is
 * display only, and nothing in this file reads a client-supplied time.
 *
 * Pure and separately tested because the failure modes are silent and
 * expensive. A grace window applied to the wrong boundary accepts an answer
 * after the lock; an off-by-one in "which section is current" restarts a
 * section a student already sat; a resume that recomputes `expiresAt` instead
 * of reading it hands back a fresh 25 minutes to anyone who closes the tab.
 * None of those throw. They just quietly produce a wrong exam.
 */

/** §10 — "answer accepted within 5s grace, then locked." */
export const ANSWER_GRACE_MS = 5_000;

/** §5.4 — "full abandonment > 24h → attempt auto-finalized." */
export const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

export type LockReason = 'manual' | 'timeout' | 'abandon';

export interface SectionWindow {
  sectionIndex: number;
  startedAt: Date;
  /** Written server-side at section start and never recomputed (§5.1). */
  expiresAt: Date;
  submittedAt: Date | null;
  lockReason: LockReason | null;
}

export interface AttemptTimingState {
  /** How many sections the blueprint declares. */
  sectionCount: number;
  /** Only the sections that have actually been started, in index order. */
  sections: SectionWindow[];
  /** Last answer, heartbeat or navigation — what the 24h abandon rule measures. */
  lastActivityAt: Date;
}

export type RuntimeAction =
  /** The section is live; serve it with the remaining time. */
  | { kind: 'resume'; sectionIndex: number }
  /** The window elapsed while the student was away; close it before anything else. */
  | { kind: 'lock_section'; sectionIndex: number; reason: 'timeout' }
  /** Nothing open and sections remain; the next one has not begun. */
  | { kind: 'start_section'; sectionIndex: number }
  /** Nothing left to sit. */
  | { kind: 'finalize'; reason: 'completed' | 'expired' | 'abandoned' };

/** Milliseconds left in the window, floored at zero. Never negative. */
export function remainingMs(window: SectionWindow, now: Date): number {
  return Math.max(0, window.expiresAt.getTime() - now.getTime());
}

/**
 * Whether an answer landing now is still accepted.
 *
 * The grace is measured from `expiresAt`, not from the request: a request that
 * arrives 4s late is a student who submitted just before the buzzer over a
 * slow connection, which §10 says to accept. A submitted section accepts
 * nothing regardless of the clock — that is what "hard-locks, no return, ever"
 * means, and it is also what stops a replayed request from re-opening it.
 */
export function acceptsAnswer(window: SectionWindow, now: Date): boolean {
  if (window.submittedAt) return false;
  return now.getTime() <= window.expiresAt.getTime() + ANSWER_GRACE_MS;
}

/** Whether the window has elapsed, ignoring the answer grace. */
export function isExpired(window: SectionWindow, now: Date): boolean {
  return now.getTime() > window.expiresAt.getTime();
}

/**
 * How an open section should be closed right now.
 *
 * A window that elapsed timed out, whatever else is going on with the attempt:
 * the student's silence does not retroactively turn a clock expiry into
 * something else, and the report distinguishes the two.
 */
export function closeReasonFor(window: SectionWindow, now: Date): LockReason {
  return isExpired(window, now) ? 'timeout' : 'abandon';
}

/**
 * The single decision the runtime makes on every request.
 *
 * Order matters and is deliberate:
 *
 * 1. Abandonment first — a student gone for 24h is finished, and walking the
 *    section clock for them would silently start sections they never saw.
 * 2. Then any open section, because an elapsed one must be locked before the
 *    attempt can move on. §5.4: "reconnect after the section window expired →
 *    that section is scored as-is, student resumes at the next section."
 * 3. Only then the next unstarted section.
 *
 * Note what is NOT here: no overall attempt deadline. §5.4 gives exactly one
 * whole-attempt rule, the 24h one, so a student who returns after twenty hours
 * legitimately resumes at the next section.
 */
export function nextAction(state: AttemptTimingState, now: Date): RuntimeAction {
  const sections = [...state.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
  const open = sections.find((s) => !s.submittedAt);

  if (now.getTime() - state.lastActivityAt.getTime() > ABANDON_AFTER_MS) {
    return { kind: 'finalize', reason: 'abandoned' };
  }

  if (open) {
    if (isExpired(open, now)) return { kind: 'lock_section', sectionIndex: open.sectionIndex, reason: 'timeout' };
    return { kind: 'resume', sectionIndex: open.sectionIndex };
  }

  if (sections.length < state.sectionCount) {
    return { kind: 'start_section', sectionIndex: sections.length };
  }

  return { kind: 'finalize', reason: 'completed' };
}

/**
 * The attempt's terminal status.
 *
 * Three states, and the difference between them is what a report is allowed to
 * claim:
 *
 * - `completed` — every section was started and closed. Includes a student who
 *   ran out of time on the last section: that is an ordinary exam ending, not
 *   a failure to sit, and lumping it in with a walk-out would stamp غير مكتمل
 *   on a perfectly valid sitting.
 * - `abandoned` — the 24h rule fired, or the student explicitly abandoned to
 *   start another attempt.
 * - `expired` — finalized with sections never started, without the abandon
 *   rule firing. In practice this is an admin force-finalize.
 *
 * All three consume the entitlement and all three start the Gate B cooldown
 * (§5.6) — abandonment is not a free reset.
 */
export function terminalStatus(
  state: AttemptTimingState,
  trigger: 'walk' | 'abandon' | 'force',
): 'completed' | 'expired' | 'abandoned' {
  if (trigger === 'abandon') return 'abandoned';
  const allStarted = state.sections.length >= state.sectionCount;
  const allClosed = state.sections.every((s) => s.submittedAt !== null);
  if (allStarted && allClosed) return 'completed';
  return 'expired';
}
