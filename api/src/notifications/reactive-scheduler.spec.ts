import { decideSendChannel, resolveSlotForDay } from './reactive-scheduler';

const DAY = new Date('2026-07-20T00:00:00Z');

describe('decideSendChannel', () => {
  it('uses a paid template with no prior inbound (cold start / disengaged student)', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const decision = decideSendChannel(null, slot);
    expect(decision.channelType).toBe('template');
    expect(decision.billable).toBe(true);
    expect(decision.sendAt).toEqual(slot.slotEnd);
  });

  it('sends free when next_send (last inbound + 24h - margin) falls inside the slot', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    // Inbound at 12:30 yesterday -> next_send ~= 12:30 - 45min = 11:45 tomorrow... use exact case:
    const lastInboundAt = new Date('2026-07-19T13:00:00Z'); // +24h-45min = 2026-07-20T12:15Z, inside 12-14
    const decision = decideSendChannel(lastInboundAt, slot);
    expect(decision.channelType).toBe('freeform');
    expect(decision.billable).toBe(false);
  });

  it('falls back to a paid template at the slot ceiling when next_send lands outside the slot', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const lastInboundAt = new Date('2026-07-19T08:00:00Z'); // +24h-45min = 07:15Z, well before the slot
    const decision = decideSendChannel(lastInboundAt, slot);
    expect(decision.channelType).toBe('template');
    expect(decision.billable).toBe(true);
    expect(decision.sendAt).toEqual(slot.slotEnd);
  });

  it('resets the cycle to paid whenever the student is slow to tap (self-correcting)', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const lateInbound = new Date('2026-07-19T20:00:00Z'); // student tapped late -> next_send lands after tomorrow's slot
    const decision = decideSendChannel(lateInbound, slot);
    expect(decision.channelType).toBe('template');
  });

  it('a wider slot admits more of the 24h-minus-margin band, favouring free sends', () => {
    const narrow = resolveSlotForDay(DAY, 12, 13); // 1h slot
    const wide = resolveSlotForDay(DAY, 8, 20); // 12h slot
    const lastInboundAt = new Date('2026-07-19T15:00:00Z'); // +24h-45min = 14:15Z
    expect(decideSendChannel(lastInboundAt, narrow).channelType).toBe('template');
    expect(decideSendChannel(lastInboundAt, wide).channelType).toBe('freeform');
  });

  it('respects a custom safety margin', () => {
    const slot = resolveSlotForDay(DAY, 12, 14);
    const lastInboundAt = new Date('2026-07-19T14:05:00Z'); // +24h-0min = 14:05Z tomorrow, just outside a 0-margin slot
    expect(decideSendChannel(lastInboundAt, slot, 0).channelType).toBe('template');
    expect(decideSendChannel(lastInboundAt, slot, 10).channelType).toBe('freeform'); // -10min = 13:55Z, inside
  });
});

describe('resolveSlotForDay', () => {
  it('produces a window on the given calendar day', () => {
    const slot = resolveSlotForDay(DAY, 18, 20);
    expect(slot.slotStart.toISOString()).toBe('2026-07-20T18:00:00.000Z');
    expect(slot.slotEnd.toISOString()).toBe('2026-07-20T20:00:00.000Z');
  });
});
