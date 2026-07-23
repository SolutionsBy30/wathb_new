import { useState } from 'react';
import { Button } from '../design-system/components/Button';

// SUP-007 — pending invites browsable within a logged-in session, not only
// reachable by tapping the original magic link, with both accept and
// reject actions (previously accept-only).
export default function PendingInvites({ invites, onAccept, onReject, onRefresh }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const act = async (id, action) => {
    setBusyId(id);
    setError(null);
    try {
      await action(id);
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>الدعوات المعلّقة</h1>
      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
      {invites.length === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد دعوات بانتظار الرد.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {invites.map((inv) => (
            <div key={inv.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>{inv.student?.user?.name}</span>
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{inv.student?.user?.mobileE164}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="primary" disabled={busyId === inv.id} onClick={() => act(inv.id, onAccept)}>
                  {busyId === inv.id ? '…' : 'قبول'}
                </Button>
                <button
                  disabled={busyId === inv.id}
                  onClick={() => act(inv.id, onReject)}
                  style={{ border: 'none', cursor: 'pointer', padding: '10px 16px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
                >
                  رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
