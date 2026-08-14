/**
 * The product's clock is Asia/Riyadh — spec §7.4 talks about notification
 * windows and report days in the student's local terms, and the server runs
 * UTC. Doing this with Intl rather than a fixed +03:00 offset keeps it correct
 * if the zone's rules ever change; KSA has no DST today, but hardcoding the
 * offset is the kind of assumption that silently rots.
 */
const RIYADH_TZ = 'Asia/Riyadh';

const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface RiyadhClock {
  /** 0 = Sunday .. 6 = Saturday, matching Supervisor.weeklyReportDay. */
  day: number;
  /** 0..23 local hour. */
  hour: number;
}

export function riyadhNow(at: Date = new Date()): RiyadhClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RIYADH_TZ,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // Intl renders midnight as "24" in some ICU versions under hour12:false.
  const hour = Number(hourRaw) % 24;
  return { day: DAY_INDEX[weekday] ?? 0, hour };
}

/**
 * Students have no per-student weekly slot the way supervisors do, so the
 * clock-driven weekly report uses one house time. Thursday evening mirrors
 * the supervisor default and lands before the KSA weekend.
 */
export const STUDENT_WEEKLY_REPORT_DAY = 4; // Thursday
export const STUDENT_WEEKLY_REPORT_HOUR = 20;

/**
 * NOT-015 — how far Riyadh is ahead of UTC at a given instant, in ms.
 *
 * Derived from Intl rather than hardcoded to +03:00 for the same reason as
 * riyadhNow: the offset is a property of the zone's rules at that instant,
 * not a constant, and a hardcoded one rots silently.
 */
function riyadhOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RIYADH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asIfUtc - at.getTime();
}

/**
 * The UTC instant at which the Riyadh wall clock reads `hour:00` on the
 * calendar day of `day`.
 *
 * This is the conversion the notification scheduler was missing. Students
 * pick their reminder window in Riyadh terms — the picker literally says
 * "بتوقيت آسيا/الرياض" — but resolveSlotForDay applied those hours with
 * setUTCHours, so "مساءً 17:00–20:00" resolved to 17:00–20:00 UTC, i.e.
 * 20:00–23:00 in Riyadh. Every reminder landed three hours late.
 *
 * Two passes: the first guesses the offset at the naive instant, the second
 * settles it at the corrected one. Riyadh has no DST so one would do, but a
 * conversion that is only correct for one zone is a trap for the next.
 */
export function riyadhHourToUtc(day: Date, hour: number): Date {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  const naive = Date.UTC(y, m, d, hour, 0, 0, 0);
  let ts = naive - riyadhOffsetMs(new Date(naive));
  ts = naive - riyadhOffsetMs(new Date(ts));
  return new Date(ts);
}

/**
 * The Riyadh calendar date of an instant, expressed as UTC midnight of that
 * date — the shape every `scheduledFor` (@db.Date) column already stores.
 *
 * Between 00:00 and 03:00 Riyadh, UTC is still on the previous date, so a
 * plain setUTCHours(0,0,0,0) calls those three hours "yesterday": a student
 * practising at 1am gets it credited to the wrong day, and their streak
 * breaks despite having shown up.
 */
export function riyadhDayKey(at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0, 0));
}
