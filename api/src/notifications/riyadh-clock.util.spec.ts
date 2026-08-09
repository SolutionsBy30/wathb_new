import { riyadhNow, STUDENT_WEEKLY_REPORT_DAY, STUDENT_WEEKLY_REPORT_HOUR } from './riyadh-clock.util';

describe('riyadhNow', () => {
  it('converts UTC to Riyadh local time (+03:00)', () => {
    // 2026-08-06 is a Thursday. 17:00 UTC = 20:00 Riyadh.
    expect(riyadhNow(new Date('2026-08-06T17:00:00Z'))).toEqual({ day: 4, hour: 20 });
  });

  it('rolls the weekday over when Riyadh is already in the next day', () => {
    // 22:30 UTC Thursday is 01:30 Friday in Riyadh — the case a naive
    // getUTCDay() would report as Thursday and send a day early.
    expect(riyadhNow(new Date('2026-08-06T22:30:00Z'))).toEqual({ day: 5, hour: 1 });
  });

  it('reports midnight as hour 0, not 24', () => {
    // 21:00 UTC = 00:00 next-day Riyadh; some ICU builds render this as "24".
    expect(riyadhNow(new Date('2026-08-06T21:00:00Z'))).toEqual({ day: 5, hour: 0 });
  });

  it('covers every hour of the day exactly once across a UTC day', () => {
    const hours = new Set<number>();
    for (let h = 0; h < 24; h++) {
      hours.add(riyadhNow(new Date(Date.UTC(2026, 7, 6, h, 0, 0))).hour);
    }
    expect(hours.size).toBe(24);
  });

  it('reports Sunday as 0, matching Supervisor.weeklyReportDay', () => {
    // 2026-08-09 is a Sunday; 09:00 UTC = 12:00 Riyadh, same calendar day.
    expect(riyadhNow(new Date('2026-08-09T09:00:00Z')).day).toBe(0);
  });

  it('places the student weekly slot on Thursday evening', () => {
    expect(STUDENT_WEEKLY_REPORT_DAY).toBe(4);
    expect(STUDENT_WEEKLY_REPORT_HOUR).toBe(20);
  });
});
