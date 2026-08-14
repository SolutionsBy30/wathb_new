import { riyadhHourToUtc } from './riyadh-clock.util';

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
 * Resolves a student's slot-hour pair to concrete UTC instants for a given
 * calendar day, interpreting the hours as ASIA/RIYADH wall-clock time.
 *
 * NOT-015 — this used to apply the hours with setUTCHours and left a comment
 * saying callers "must convert from the student's timezone first". No caller
 * ever did, so the trap the comment predicted landed: students choose their
 * window in Riyadh terms (the picker says "بتوقيت آسيا/الرياض") and every
 * reminder went out three hours late — "مساءً 17:00–20:00" resolved to
 * 20:00–23:00 Riyadh.
 *
 * Doing the conversion here rather than at the call site means there is one
 * place to be right, and no way to forget. Spec §9.3's warning still stands
 * for the day a non-KSA student signs up: the zone is hardcoded to Riyadh,
 * so per-student timezones need User.timezone threaded through here.
 */
export function resolveSlotForDay(day: Date, slotStartHour: number, slotEndHour: number): SlotWindow {
  return {
    slotStart: riyadhHourToUtc(day, slotStartHour),
    slotEnd: riyadhHourToUtc(day, slotEndHour),
  };
}
