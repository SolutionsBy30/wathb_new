/**
 * COM — WhatsApp sending hygiene, as pure functions.
 *
 * Wasender is an unofficial WhatsApp-Web bridge: a real phone session that
 * WhatsApp can and does flag. Everything here exists to make our traffic look
 * like a person's rather than a broadcaster's, and to stop us doing the two
 * things that most reliably get a number blocked — messaging people who cannot
 * receive, and sending in a perfectly regular machine rhythm.
 *
 * Pure and tested because none of it fails loudly. A broken jitter still
 * sends; a wrong warm-up curve still sends; a suppression threshold off by one
 * still sends. The only symptom is a number that gets flagged weeks later,
 * which is far too slow a feedback loop to debug against production.
 */

// ---------------------------------------------------------------- 1. suppress

/**
 * How many consecutive exhausted retry ladders before we stop trying a number.
 *
 * A run is one day's send that used every rung and never arrived. Three is
 * enough to rule out a transient outage — our own session being down fails
 * every student at once and is handled separately, before the ladder — while
 * still cutting off a number that simply is not on WhatsApp within the week.
 */
export const DEFAULT_SUPPRESS_AFTER_RUNS = 3;

export function shouldSuppress(failedRuns: number, threshold = DEFAULT_SUPPRESS_AFTER_RUNS): boolean {
  return failedRuns >= threshold;
}

// ------------------------------------------------------------------ 2. jitter

export const DEFAULT_MIN_INTERVAL_MS = 5_500;
export const DEFAULT_MAX_INTERVAL_MS = 12_000;

/**
 * A random gap between sends rather than a fixed one.
 *
 * Exactly 5.5s apart, forever, is a signature no human produces. The range is
 * wide enough that the pattern is not recoverable from a handful of samples,
 * and the floor is never below the configured minimum.
 */
export function nextIntervalMs(
  minMs = DEFAULT_MIN_INTERVAL_MS,
  maxMs = DEFAULT_MAX_INTERVAL_MS,
  rng: () => number = Math.random,
): number {
  const lo = Math.max(0, minMs);
  // A max below the min is a misconfiguration, not a reason to send faster
  // than the floor.
  const hi = Math.max(lo, maxMs);
  return Math.round(lo + rng() * (hi - lo));
}

// ------------------------------------------------------------------ 3. spread

/**
 * Fraction of the student's window used for spreading.
 *
 * The tail is deliberately left empty: a send placed at the very end of the
 * window gets one cron tick before it closes, and a single failure there means
 * the student hears nothing that day. Reserving the last fifth leaves room for
 * the retry ladder to land inside the window it belongs to.
 */
export const SPREAD_FRACTION = 0.8;

/** FNV-1a. Not security-bearing — it decides what minute a reminder lands on. */
function hash32(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stable offset into the window for one student.
 *
 * Deterministic on the student id, not random: the same student should get
 * roughly the same time every evening, because a reminder that wanders across
 * two hours night to night is worse for a habit product than one that is
 * merely not on the hour. It also means no state to store.
 */
export function sendOffsetMs(key: string, windowMs: number, spread = SPREAD_FRACTION): number {
  if (windowMs <= 0) return 0;
  const usable = Math.max(0, Math.floor(windowMs * spread));
  if (usable === 0) return 0;
  return hash32(key) % usable;
}

/** The moment this student's send becomes due, inside their own window. */
export function scheduledSendAt(key: string, slotStart: Date, slotEnd: Date): Date {
  const windowMs = slotEnd.getTime() - slotStart.getTime();
  return new Date(slotStart.getTime() + sendOffsetMs(key, windowMs));
}

// --------------------------------------------------------- 4. cap + warm-up

/** How long a newly linked number ramps before it sends at full volume. */
export const WARMUP_DAYS = 14;

/** What a number is allowed on its first day. */
export const WARMUP_FIRST_DAY_CAP = 20;

/**
 * The ramp's destination when no explicit cap is configured. Not a limit
 * anyone chose — just a ceiling for the curve, after which the sender is
 * uncapped again.
 */
export const WARMUP_DEFAULT_TARGET = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Today's ceiling for one sender, accounting for warm-up.
 *
 * Returns null for "no limit". A number that has finished warming up is
 * governed by its configured cap alone, and a number with no cap and no
 * warm-up is unlimited — which is the behaviour every existing install has
 * today, so this stays a no-op until someone configures it.
 */
export function effectiveDailyCap(
  cap: number | null,
  warmupStartedAt: Date | null,
  now: Date = new Date(),
): number | null {
  if (!warmupStartedAt) return cap;

  const dayIndex = Math.floor((now.getTime() - warmupStartedAt.getTime()) / DAY_MS);
  // A start date in the future is a data-entry slip; treat it as day one
  // rather than handing out a negative allowance.
  if (dayIndex >= WARMUP_DAYS) return cap;

  const target = cap ?? WARMUP_DEFAULT_TARGET;
  if (target <= WARMUP_FIRST_DAY_CAP) return target;

  const progress = Math.min(1, Math.max(0, dayIndex) / (WARMUP_DAYS - 1));
  const ramped = Math.round(WARMUP_FIRST_DAY_CAP + (target - WARMUP_FIRST_DAY_CAP) * progress);
  return Math.min(ramped, target);
}

/** Is there room to send one more today? */
export function withinDailyCap(sentToday: number, cap: number | null): boolean {
  return cap === null || sentToday < cap;
}

// ------------------------------------------------------------ 6. reachability

export type Reachability = 'reachable' | 'unreachable' | 'unknown';

/**
 * Read a vendor reachability response without guessing.
 *
 * The shape of this endpoint is not something we can verify from here, so
 * anything unrecognised is `unknown` and never `unreachable`. Getting that
 * backwards would silently refuse to message real students because a response
 * key was named differently than expected — a far worse outcome than letting a
 * bad number through to the suppression ladder, which catches it anyway.
 */
export function readReachability(payload: unknown): Reachability {
  if (!payload || typeof payload !== 'object') return 'unknown';
  const o = payload as Record<string, unknown>;
  const data = (o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o);

  for (const key of ['exists', 'isOnWhatsapp', 'isOnWhatsApp', 'onWhatsapp', 'valid']) {
    const v = data[key];
    if (typeof v === 'boolean') return v ? 'reachable' : 'unreachable';
  }
  return 'unknown';
}
