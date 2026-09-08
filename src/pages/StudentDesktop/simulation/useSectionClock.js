import { useEffect, useRef, useState } from 'react';

/**
 * SIM-011 — §5.1, the display clock.
 *
 * Derived from the server's absolute `expiresAt` on every tick, never from a
 * seconds counter decremented locally. That distinction is the whole point:
 *
 *  - a suspended or backgrounded tab (phone locked, laptop shut) stops firing
 *    intervals, so a decrementing counter would come back reading whatever it
 *    held when the tab froze and hand the student minutes they do not have;
 *  - `Date.now()` against the stored deadline is right the instant the tab
 *    wakes, with no resync step to forget.
 *
 * The clock is display only regardless. The server re-checks its own
 * `expiresAt` on every write, so nothing here can grant or deny time — the
 * worst a wrong client clock does is show a wrong number.
 */
export function useSectionClock(expiresAt, onElapsed) {
  const [remainingMs, setRemainingMs] = useState(() => msLeft(expiresAt));
  const firedRef = useRef(false);
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;

  useEffect(() => {
    firedRef.current = false;
    setRemainingMs(msLeft(expiresAt));
    if (!expiresAt) return undefined;

    const tick = () => {
      const left = msLeft(expiresAt);
      setRemainingMs(left);
      // Fire once. The client never locks the section itself — it asks the
      // server what happened, and the server decides.
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onElapsedRef.current?.();
      }
    };

    const id = setInterval(tick, 250);
    // A tab that wakes from sleep should not wait up to 250ms to show the
    // truth, and may well already be past the deadline.
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt]);

  return remainingMs;
}

function msLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

/** mm:ss, Arabic-Indic, zero-padded so the width does not jitter. */
export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return toArabicDigits(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export function toArabicDigits(value) {
  return String(value).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

/**
 * §5.1 — "warning states at 05:00 and 01:00 (colour shift, no modal — modals
 * steal exam time)."
 */
export function clockTone(remainingMs) {
  if (remainingMs <= 60_000) return 'critical';
  if (remainingMs <= 5 * 60_000) return 'warning';
  return 'normal';
}
