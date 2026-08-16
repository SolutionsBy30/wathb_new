import { decideSendChannel, resolveSlotForDay } from './reactive-scheduler';

const DAY = new Date('2026-07-20T00:00:00Z');

// NOT-015 — slot hours are ASIA/RIYADH wall-clock, so a 12–14 slot is
// 09:00Z–11:00Z. Every inbound timestamp below is chosen against that, not
// against the raw hour numbers.
describe('decideSendChannel', () => {
  it('uses a paid template with no prior inbound (cold start / disengaged student)', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const decision = decideSendChannel(null, slot);
    expect(decision.channelType).toBe('template');
    expect(decision.billable).toBe(true);
    expect(decision.sendAt).toEqual(slot.slotEnd);
  });

  it('sends free when next_send (last inbound + 24h - margin) falls inside the slot', () => {
    const slot = resolveSlotForDay(DAY, 12, 14); // 09:00Z–11:00Z
    const lastInboundAt = new Date('2026-07-19T10:00:00Z'); // +24h-45min = 09:15Z, inside
    const decision = decideSendChannel(lastInboundAt, slot);
    expect(decision.channelType).toBe('freeform');
    expect(decision.billable).toBe(false);
  });

  it('falls back to a paid template at the slot ceiling when next_send lands outside the slot', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const lastInboundAt = new Date('2026-07-19T05:00:00Z'); // +24h-45min = 04:15Z, well before the slot
    const decision = decideSendChannel(lastInboundAt, slot);
    expect(decision.channelType).toBe('template');
    expect(decision.billable).toBe(true);
    expect(decision.sendAt).toEqual(slot.slotEnd);
  });

  it('resets the cycle to paid whenever the student is slow to tap (self-correcting)', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const lateInbound = new Date('2026-07-19T17:00:00Z'); // +24h-45min = 16:15Z, after the slot
    const decision = decideSendChannel(lateInbound, slot);
    expect(decision.channelType).toBe('template');
  });

  it('a wider slot admits more of the 24h-minus-margin band, favouring free sends', () => {
    const narrow = resolveSlotForDay(DAY, 12, 13); // 1h slot -> 09:00Z–10:00Z
    const wide = resolveSlotForDay(DAY, 8, 20); // 12h slot -> 05:00Z–17:00Z
    const lastInboundAt = new Date('2026-07-19T12:00:00Z'); // +24h-45min = 11:15Z
    expect(decideSendChannel(lastInboundAt, narrow).channelType).toBe('template');
    expect(decideSendChannel(lastInboundAt, wide).channelType).toBe('freeform');
  });

  it('respects a custom safety margin', () => {
    const slot = resolveSlotForDay(DAY, 12, 14); // 09:00Z–11:00Z
    const lastInboundAt = new Date('2026-07-19T11:05:00Z'); // +24h = 11:05Z, just past the ceiling
    expect(decideSendChannel(lastInboundAt, slot, 0).channelType).toBe('template');
    expect(decideSendChannel(lastInboundAt, slot, 10).channelType).toBe('freeform'); // -10min = 10:55Z, inside
  });
});

describe('resolveSlotForDay', () => {
  /**
   * The regression this pins: these hours used to be applied with
   * setUTCHours, so a student picking مساءً (17–20, labelled "بتوقيت
   * آسيا/الرياض" in the picker) had their window resolved to 17:00–20:00 UTC
   * — 20:00–23:00 in Riyadh. Every reminder went out three hours late.
   */
  it('interprets slot hours as Riyadh wall-clock, not UTC', () => {
    const slot = resolveSlotForDay(DAY, 18, 20);
    expect(slot.slotStart.toISOString()).toBe('2026-07-20T15:00:00.000Z');
    expect(slot.slotEnd.toISOString()).toBe('2026-07-20T17:00:00.000Z');
  });

  it('round-trips back to the hours the student chose', () => {
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(d);
    for (const [start, end] of [[7, 11], [11, 14], [14, 17], [17, 20], [20, 22]]) {
      const slot = resolveSlotForDay(DAY, start, end);
      expect(Number(fmt(slot.slotStart)) % 24).toBe(start);
      expect(Number(fmt(slot.slotEnd)) % 24).toBe(end);
    }
  });

  it('keeps the whole window inside one calendar day (no midnight crossing)', () => {
    const slot = resolveSlotForDay(DAY, 20, 22); // the latest named slot
    expect(slot.slotEnd.getTime()).toBeGreaterThan(slot.slotStart.getTime());
    expect(slot.slotEnd.toISOString().slice(0, 10)).toBe('2026-07-20');
  });
});

/**
 * NOT-016 — the window is now enforced, not merely consulted.
 *
 * These assert the boundary arithmetic that sendDailyWathbNotification uses.
 * The bug they guard against: plan_day queues tomorrow's row at 21:00, so the
 * instant the Riyadh date rolled over the row became "today's" and the next
 * send_due tick fired it — every reminder arriving near midnight regardless of
 * what the student picked.
 */
describe('send-window enforcement', () => {
  const WINDOW_GRACE_MINUTES = 60;
  const inWindow = (now: Date, slot: { slotStart: Date; slotEnd: Date }) =>
    now >= slot.slotStart && now.getTime() <= slot.slotEnd.getTime() + WINDOW_GRACE_MINUTES * 60_000;

  // مساءً = 17:00–20:00 Riyadh = 14:00Z–17:00Z.
  const slot = resolveSlotForDay(DAY, 17, 20);

  it('refuses the midnight send that started this', () => {
    // 00:05 Riyadh on the same date is 21:05Z the day before.
    expect(inWindow(new Date('2026-07-19T21:05:00Z'), slot)).toBe(false);
  });

  it('refuses any time before the window opens', () => {
    expect(inWindow(new Date('2026-07-20T13:59:00Z'), slot)).toBe(false);
  });

  it('sends from the moment the window opens', () => {
    expect(inWindow(new Date('2026-07-20T14:00:00Z'), slot)).toBe(true);
    expect(inWindow(new Date('2026-07-20T15:30:00Z'), slot)).toBe(true);
    expect(inWindow(new Date('2026-07-20T17:00:00Z'), slot)).toBe(true);
  });

  it('allows a short grace past the close, for a missed tick', () => {
    expect(inWindow(new Date('2026-07-20T17:59:00Z'), slot)).toBe(true);
    expect(inWindow(new Date('2026-07-20T18:01:00Z'), slot)).toBe(false);
  });
});
