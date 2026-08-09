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
