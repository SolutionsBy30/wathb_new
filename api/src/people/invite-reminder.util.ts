/**
 * SUP-009 — when to nudge a supervisor who has not answered an invite yet.
 *
 * The cadence, in the product owner's words: "when the invitation sent, after
 * one day, every two days for one week, then weekly". Reading that as offsets
 * from the moment of invitation:
 *
 *   rung 0  the invite message itself, sent inline by SupervisorsService.invite
 *   rung 1  +1 day
 *   rung 2  +3 days   ┐
 *   rung 3  +5 days   ├ every two days, across the week that follows rung 1
 *   rung 4  +7 days   ┘
 *   rung 5+ +14, +21, +28 … weekly thereafter
 *
 * Kept as a pure function of (invitedAt, reminderCount) rather than as
 * "lastRemindedAt + interval" so that a tick that runs late — a restart, a
 * scheduler that was off overnight — sends the rung that is due and then
 * returns to the original schedule, instead of pushing every later rung out by
 * however long the outage lasted.
 */

/** Offsets in days from invitedAt for the fixed rungs of the ladder. */
export const FIXED_REMINDER_DAYS = [1, 3, 5, 7] as const;

/** Once the fixed rungs are spent, one reminder every this many days. */
export const WEEKLY_INTERVAL_DAYS = 7;

/**
 * Stop nagging eventually. Not in the brief, but an invite nobody has answered
 * after this long is not going to be answered, and WhatsApp treats indefinite
 * unanswered outreach as spam — which puts the number that also carries OTPs
 * and daily leaps at risk. Raise or remove deliberately, not by accident.
 */
export const MAX_REMINDER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the next reminder is due, or null once the ladder is exhausted.
 *
 * @param invitedAt     when the invite was sent (the ladder's origin)
 * @param reminderCount how many reminders have already gone out (0 = none yet)
 */
export function nextReminderAt(invitedAt: Date, reminderCount: number): Date | null {
  const offsetDays =
    reminderCount < FIXED_REMINDER_DAYS.length
      ? FIXED_REMINDER_DAYS[reminderCount]
      : // First weekly rung lands a week after the last fixed one (day 7 → 14).
        FIXED_REMINDER_DAYS[FIXED_REMINDER_DAYS.length - 1] +
        WEEKLY_INTERVAL_DAYS * (reminderCount - FIXED_REMINDER_DAYS.length + 1);

  if (offsetDays > MAX_REMINDER_DAYS) return null;
  return new Date(invitedAt.getTime() + offsetDays * DAY_MS);
}

/** True when the next rung is due at or before `now`. */
export function isReminderDue(invitedAt: Date, reminderCount: number, now: Date): boolean {
  const due = nextReminderAt(invitedAt, reminderCount);
  return due !== null && due.getTime() <= now.getTime();
}
