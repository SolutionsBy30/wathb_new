import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';

export default function GoalSetup({ tests, onSubmit, busy }) {
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  const [track, setTrack] = useState('scientific');

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>
        إعداد الهدف
      </h1>
      <p style={{ margin: 0, maxWidth: '420px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
        اختر الاختبار المستهدف والمسار — تحدد هذه الخطوة محتوى وثبتك اليومية.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setTestId(t.id)}
            style={{
              textAlign: 'start', border: 'none', cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-arabic)', fontSize: '14px',
              background: testId === t.id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
              color: testId === t.id ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.nameAr}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {[{ id: 'scientific', label: 'علمي' }, { id: 'humanities', label: 'أدبي' }].map((o) => (
          <button
            key={o.id}
            onClick={() => setTrack(o.id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '10px 18px', borderRadius: '999px',
              fontFamily: 'var(--font-arabic)', fontSize: '13px',
              background: track === o.id ? 'var(--sand)' : 'var(--on-indigo-subtle)',
              color: track === o.id ? 'var(--indigo)' : 'var(--sand)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Button variant="primary" disabled={busy || !testId} onClick={() => onSubmit({ targetTestId: testId, track })}>
        {busy ? 'جاري الحفظ…' : 'متابعة'}
      </Button>
    </>
  );
}
