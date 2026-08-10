import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { NOTIFICATION_SLOTS, slotById, slotIdFromHours, slotTimeRange } from '../../../lib/notification-slots';

// ONB-012 — spec: "a notification-window slot picker, timezone (default
// Asia/Riyadh), and a configurable skip-days toggle." The slots are named
// parts of the day (صباحاً/ظهراً/…) rather than clock ranges; see
// src/lib/notification-slots.js for the hour windows behind them.
const DAYS = [
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الاثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
  { id: 6, label: 'السبت' },
];

export default function NotificationSlotSetup({ initialStartHour, initialEndHour, initialSkipDays, onSubmit, busy }) {
  const [slotId, setSlotId] = useState(() => slotIdFromHours(initialStartHour, initialEndHour));
  const [skipDays, setSkipDays] = useState(new Set(initialSkipDays ?? [5]));
  const slot = slotById(slotId);

  const toggleDay = (id) => {
    setSkipDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>
        موعد التذكير اليومي
      </h1>
      <p style={{ margin: 0, maxWidth: '420px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
        اختر النافذة الزمنية التي تفضّل استلام تذكير وثبتك اليومية عبر واتساب خلالها، والأيام التي تودّ إيقاف التذكير فيها.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '420px' }}>
        <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>وقت التذكير (بتوقيت آسيا/الرياض)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {NOTIFICATION_SLOTS.map((s) => (
            <button
              key={s.id}
              aria-pressed={slotId === s.id}
              onClick={() => setSlotId(s.id)}
              style={{
                border: 'none', cursor: 'pointer', minHeight: '44px', padding: '8px 16px', borderRadius: '999px',
                fontFamily: 'var(--font-arabic)', fontSize: '13px',
                background: slotId === s.id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
                color: slotId === s.id ? 'var(--lime-ink)' : 'var(--sand)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>
          يصلك التذكير بين <span dir="ltr" style={{ fontFamily: 'var(--font-latin)' }}>{slotTimeRange(slot)}</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '420px' }}>
        <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>إيقاف التذكير في أيام معيّنة (اختياري)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {DAYS.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDay(d.id)}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: '999px',
                fontFamily: 'var(--font-arabic)', fontSize: '12px',
                background: skipDays.has(d.id) ? 'var(--coral)' : 'var(--on-indigo-subtle)',
                color: skipDays.has(d.id) ? 'var(--indigo)' : 'var(--sand)',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        disabled={busy}
        onClick={() => onSubmit({ notifSlotStartHour: slot.startHour, notifSlotEndHour: slot.endHour, skipDays: [...skipDays] })}
      >
        {busy ? 'جاري الحفظ…' : 'متابعة'}
      </Button>
    </>
  );
}
