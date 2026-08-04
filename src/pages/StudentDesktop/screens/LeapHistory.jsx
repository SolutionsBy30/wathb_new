import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { LeapHistoryTable } from '../../../design-system/components/LeapHistoryTable';

// The student's own leap report — every bundle they've taken, with date,
// test and score. Same data and presentation the supervisor and admin see.
export default function LeapHistory({ onBack }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.myLeaps().then(setRows).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      {onBack && (
        <button onClick={onBack} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
          → رجوع
        </button>
      )}
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>سجل الوثبات</h1>
      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
      {!rows && !error && <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>}
      {rows && <LeapHistoryTable rows={rows} />}
    </>
  );
}
