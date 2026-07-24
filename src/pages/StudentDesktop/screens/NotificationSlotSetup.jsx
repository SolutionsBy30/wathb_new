import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';

// ONB-012 — spec: "a notification-window slot picker (2-hour slots),
// timezone (default Asia/Riyadh), and a configurable skip-days toggle."
// The 2-hour slots stop at a 20-22 start (not 22-24) so the window never
// has to cross midnight — resolveSlotForDay (reactive-scheduler.ts) builds
// both edges from the same calendar day via setUTCHours, and an end hour
// of 24 would roll over into the next day.
const SLOT_STARTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const DAYS = [
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الاثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
  { id: 6, label: 'السبت' },
];

function formatSlot(h) {
  return `${h}:00 – ${h + 2}:00`;
}

export default function NotificationSlotSetup({ initialStartHour, initialEndHour, initialSkipDays, onSubmit, busy }) {
  const [slotStart, setSlotStart] = useState(
    SLOT_STARTS.includes(initialStartHour) && initialEndHour === initialStartHour + 2 ? initialStartHour : 18,
  );
  const [skipDays, setSkipDays] = useState(new Set(initialSkipDays ?? [5]));

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
        <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>النافذة الزمنية (بتوقيت آسيا/الرياض)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SLOT_STARTS.map((h) => (
            <button
              key={h}
              dir="ltr"
              onClick={() => setSlotStart(h)}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: '999px',
                fontFamily: 'var(--font-latin)', fontSize: '12px',
                background: slotStart === h ? 'var(--lime)' : 'var(--on-indigo-subtle)',
                color: slotStart === h ? 'var(--lime-ink)' : 'var(--sand)',
              }}
            >
              {formatSlot(h)}
            </button>
          ))}
        </div>
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
        onClick={() => onSubmit({ notifSlotStartHour: slotStart, notifSlotEndHour: slotStart + 2, skipDays: [...skipDays] })}
      >
        {busy ? 'جاري الحفظ…' : 'متابعة'}
      </Button>
    </>
  );
}
