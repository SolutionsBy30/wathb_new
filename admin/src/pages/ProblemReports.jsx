import { useEffect, useState } from 'react';
import { api } from '../api/client';

function fmtDateTime(d) {
  return new Date(d).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

// STU-012 — the admin inbox for student-reported problems: the flag with
// the student's answer attached, per spec §3.3.
export default function ProblemReports({ onEditQuestion }) {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = () => api.listProblemReports(status).then(setItems);
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (id) => {
    setBusyId(id);
    try {
      await api.resolveProblemReport(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>بلاغات المشاكل</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[['open', 'مفتوحة'], ['resolved', 'محلولة']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '13px',
                background: status === v ? 'var(--lime)' : 'var(--on-indigo-subtle)', color: status === v ? 'var(--lime-ink)' : 'var(--sand)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد بلاغات.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((r) => (
            <div key={r.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  onClick={() => onEditQuestion(r.question.id)}
                  style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', cursor: 'pointer', textDecoration: 'underline', maxWidth: '480px' }}
                >
                  {r.answer?.questionVersion?.stem ?? '(سؤال محذوف)'}
                </span>
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{fmtDateTime(r.createdAt)}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                من: {r.student?.user?.name} · التصنيف: {r.question?.label?.nameAr}
              </span>
              {r.note && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{r.note}</p>}
              {r.status === 'open' ? (
                <button
                  disabled={busyId === r.id}
                  onClick={() => resolve(r.id)}
                  style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
                >
                  {busyId === r.id ? '…' : 'وضع علامة كمحلولة'}
                </button>
              ) : (
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal-ink)' }}>حُلَّت {fmtDateTime(r.resolvedAt)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
