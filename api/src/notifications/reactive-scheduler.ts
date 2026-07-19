// §7.3 — the reactive scheduler. Pure functions, no DB/Nest dependency, so
// this is unit-testable exactly like the selection engine.
//
//   next_send = last_inbound_at + 24h - SAFETY_MARGIN
//   if next_send falls inside the student's slot:
//         send free-form (or utility template) -> FREE
//   else:
//         send utility template at slot ceiling -> PAID, resets the cycle
//
// The width of the slot sets the cost ratio: a wider slot gives more
// positions for next_send to land in-window, so fewer paid sends per week.

export interface SlotWindow {
  /** Today's slot start, as a concrete Date (already resolved to the student's tz). */
  slotStart: Date;
  slotEnd: Date;
}

export type ChannelDecision =
  | { channelType: 'freeform'; billable: false; sendAt: Date }
  | { channelType: 'template'; billable: true; sendAt: Date };

const DEFAULT_SAFETY_MARGIN_MINUTES = 45;

export function decideSendChannel(
  lastInboundAt: Date | null,
  slot: SlotWindow,
  safetyMarginMinutes: number = DEFAULT_SAFETY_MARGIN_MINUTES,
): ChannelDecision {
  if (!lastInboundAt) {
    // Cold start, or a disengaged student who never tapped back — no window
    // to reuse. Utility template at the slot ceiling; this is exactly the
    // "degrades to one paid template a day" case the spec calls out as fine.
    return { channelType: 'template', billable: true, sendAt: slot.slotEnd };
  }

  const nextSend = new Date(lastInboundAt.getTime() + 24 * 3600_000 - safetyMarginMinutes * 60_000);
  if (nextSend >= slot.slotStart && nextSend <= slot.slotEnd) {
    return { channelType: 'freeform', billable: false, sendAt: nextSend };
  }
  return { channelType: 'template', billable: true, sendAt: slot.slotEnd };
}

/**
 * Resolves a student's slot-hour pair to concrete UTC Dates for a given
 * calendar day. Treats slotStartHour/slotEndHour as UTC hours directly —
 * callers in a real deployment must convert from the student's IANA
 * timezone to UTC first (e.g. with date-fns-tz/luxon). Spec §9.3 flags this
 * exact trap: "Riyadh has no DST, which will lull the team into a false
 * sense of security until the first Egyptian or Jordanian student signs up."
 * Kept simple here since Asia/Riyadh (the only seeded tz) is a fixed UTC+3
 * with no DST, and the thing under test is the scheduling *decision*, not
 * timezone conversion.
 */
export function resolveSlotForDay(day: Date, slotStartHour: number, slotEndHour: number): SlotWindow {
  const slotStart = new Date(day);
  slotStart.setUTCHours(slotStartHour, 0, 0, 0);
  const slotEnd = new Date(day);
  slotEnd.setUTCHours(slotEndHour, 0, 0, 0);
  return { slotStart, slotEnd };
}
