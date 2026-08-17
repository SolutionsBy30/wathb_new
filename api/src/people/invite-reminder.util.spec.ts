import { FIXED_REMINDER_DAYS, MAX_REMINDER_DAYS, isReminderDue, nextReminderAt } from './invite-reminder.util';

const INVITED = new Date('2026-03-01T09:00:00.000Z');
const days = (n: number) => new Date(INVITED.getTime() + n * 24 * 60 * 60 * 1000);

describe('nextReminderAt', () => {
  it('puts the first reminder one day after the invite', () => {
    expect(nextReminderAt(INVITED, 0)).toEqual(days(1));
  });

  it('then reminds every two days across the following week', () => {
    expect(nextReminderAt(INVITED, 1)).toEqual(days(3));
    expect(nextReminderAt(INVITED, 2)).toEqual(days(5));
    expect(nextReminderAt(INVITED, 3)).toEqual(days(7));
  });

  it('falls back to weekly once the fixed rungs are spent', () => {
    expect(nextReminderAt(INVITED, 4)).toEqual(days(14));
    expect(nextReminderAt(INVITED, 5)).toEqual(days(21));
    expect(nextReminderAt(INVITED, 6)).toEqual(days(28));
  });

  it('keeps the same time of day as the invite at every rung', () => {
    for (let n = 0; n < 8; n++) {
      const at = nextReminderAt(INVITED, n);
      expect(at?.getUTCHours()).toBe(INVITED.getUTCHours());
    }
  });

  it('stops once the ladder passes MAX_REMINDER_DAYS', () => {
    // Walk out until it gives up rather than hard-coding which rung that is,
    // so raising the cap doesn't silently break this expectation.
    let n = 0;
    while (nextReminderAt(INVITED, n) !== null) {
      expect(n).toBeLessThan(1000); // guards against an accidental infinite ladder
      n++;
    }
    const lastSent = nextReminderAt(INVITED, n - 1)!;
    const elapsedDays = (lastSent.getTime() - INVITED.getTime()) / (24 * 60 * 60 * 1000);
    expect(elapsedDays).toBeLessThanOrEqual(MAX_REMINDER_DAYS);
  });

  it('is a function of the invite time, not of when the last reminder went out', () => {
    // A tick that runs three days late still schedules rung 2 for day 3 —
    // the outage is absorbed rather than pushed into every later rung.
    expect(nextReminderAt(INVITED, 1)).toEqual(days(3));
  });
});

describe('isReminderDue', () => {
  it('is false before the rung comes round', () => {
    expect(isReminderDue(INVITED, 0, days(0.5))).toBe(false);
  });

  it('is true at the exact moment it falls due', () => {
    expect(isReminderDue(INVITED, 0, days(1))).toBe(true);
  });

  it('is true for a rung that was missed entirely', () => {
    expect(isReminderDue(INVITED, 0, days(6))).toBe(true);
  });

  it('is false once the ladder is exhausted, however late it is', () => {
    expect(isReminderDue(INVITED, 999, days(10_000))).toBe(false);
  });

  it('does not fire a rung early just because the previous one was late', () => {
    // rung 1 (day 3) sent late on day 6; rung 2 is still day 5 — already past,
    // so due. But rung 3 (day 7) must not fire on day 6.
    expect(isReminderDue(INVITED, FIXED_REMINDER_DAYS.length - 1, days(6))).toBe(false);
  });
});
