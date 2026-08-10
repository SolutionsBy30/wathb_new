// ONB-012 — students pick *when in the day* they want the reminder, not a
// clock range. "8:00 – 10:00" asks someone to translate a habit into an
// hour; "صباحاً" is the way they already think about it.
//
// The stored shape is unchanged (notifSlotStartHour / notifSlotEndHour), so
// resolveSlotForDay and every scheduler path keep working — this is a naming
// layer over the same two integers.
//
// Windows are contiguous and never cross midnight: resolveSlotForDay builds
// both edges from the same calendar day via setUTCHours, so an end hour of
// 24 would roll into the next day. Night therefore stops at 22.
export const NOTIFICATION_SLOTS = [
  { id: 'morning', label: 'صباحاً', startHour: 7, endHour: 11 },
  { id: 'noon', label: 'ظهراً', startHour: 11, endHour: 14 },
  { id: 'afternoon', label: 'عصراً', startHour: 14, endHour: 17 },
  { id: 'evening', label: 'مساءً', startHour: 17, endHour: 20 },
  { id: 'night', label: 'ليلاً', startHour: 20, endHour: 22 },
];

export const DEFAULT_SLOT_ID = 'evening';

export function slotById(id) {
  return NOTIFICATION_SLOTS.find((s) => s.id === id) ?? NOTIFICATION_SLOTS.find((s) => s.id === DEFAULT_SLOT_ID);
}

// Existing accounts hold arbitrary hour pairs from the old picker (and the
// 2-hour onboarding slots before it). Map them onto the nearest named slot
// rather than silently resetting someone's choice: exact match wins, then
// whichever window contains their start hour, then the closest start hour.
export function slotIdFromHours(startHour, endHour) {
  if (startHour == null) return DEFAULT_SLOT_ID;
  const exact = NOTIFICATION_SLOTS.find((s) => s.startHour === startHour && s.endHour === endHour);
  if (exact) return exact.id;
  const containing = NOTIFICATION_SLOTS.find((s) => startHour >= s.startHour && startHour < s.endHour);
  if (containing) return containing.id;
  return NOTIFICATION_SLOTS.reduce((best, s) =>
    Math.abs(s.startHour - startHour) < Math.abs(best.startHour - startHour) ? s : best,
  ).id;
}

// For the "your reminder arrives …" hint under the picker. LTR digits inside
// an RTL sentence, so callers wrap it with dir="ltr".
export function slotTimeRange(slot) {
  return `${slot.startHour}:00 – ${slot.endHour}:00`;
}
