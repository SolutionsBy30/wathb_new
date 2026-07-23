import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

// ADM-027 — a review queue lists in_review questions for a second reviewer
// to approve/reject with a comment (spec §3.4), distinct from the generic
// status filter on the question bank table.
export default function ReviewQueue({ onEdit }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [comments, setComments] = useState({});
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setItems(await api.reviewQueue());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setComment = (id, value) => setComments((c) => ({ ...c, [id]: value }));

  const approve = async (id) => {
    setBusyId(id);
    setError(null);
    try {
      await api.approveQuestion(id, comments[id]?.trim() || undefined);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    const comment = comments[id]?.trim();
    if (!comment) return setError('التعليق إلزامي عند الرفض — يحتاج معدّ السؤال معرفة السبب.');
    setBusyId(id);
    setError(null);
    try {
      await api.rejectQuestion(id, comment);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>قائمة المراجعة</h1>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{items.length} بانتظار المراجعة</span>
      </div>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}

      {loading ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد أسئلة بانتظار المراجعة.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((q) => {
            const v = q.versions[0];
            return (
              <div key={q.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span
                      onClick={() => onEdit(q.id)}
                      style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', cursor: 'pointer' }}
                    >
                      {v?.stem}
                    </span>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                      {q.label?.area?.section?.test?.nameAr} · {q.label?.area?.nameAr} · {q.label?.nameAr} · صعوبة {q.difficulty}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {v?.options?.map((o) => (
                    <span
                      key={o.key}
                      style={{
                        fontFamily: 'var(--font-arabic)', fontSize: '13px',
                        color: o.key === v.correctKey ? 'var(--lime)' : 'var(--sand)',
                      }}
                    >
                      {o.key === v.correctKey ? '✓ ' : '· '}{o.text}
                    </span>
                  ))}
                </div>

                <input
                  value={comments[q.id] ?? ''}
                  onChange={(e) => setComment(q.id, e.target.value)}
                  placeholder="تعليق (إلزامي عند الرفض)…"
                  style={{ padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button variant="primary" disabled={busyId === q.id} onClick={() => approve(q.id)}>
                    {busyId === q.id ? '…' : 'اعتماد'}
                  </Button>
                  <button
                    disabled={busyId === q.id}
                    onClick={() => reject(q.id)}
                    style={{ border: 'none', cursor: 'pointer', padding: '10px 16px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
                  >
                    رفض
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
