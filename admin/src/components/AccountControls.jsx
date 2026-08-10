import { useState } from 'react';
import { api } from '../api/client';

const input = {
  padding: '7px 9px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--indigo)', color: 'var(--sand)',
  fontFamily: 'var(--font-arabic)', fontSize: '12px', width: '150px',
};
const linkBtn = {
  border: 'none', background: 'transparent', color: 'var(--mist)',
  cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px', padding: 0,
};

/**
 * ADM-086 — edit and disable, shared by the students and supervisors tables.
 *
 * Both sit on `users`, so one component serves both rather than two screens
 * drifting apart in what an admin can change.
 *
 * "Disable" is suspend/unsuspend, not deletion: it is reversible, written to
 * the audit log with a required reason, and revokes the account's live magic
 * links so an open link can't outlive the suspension. Deleting the row would
 * take the student's whole answer history with it.
 */
export default function AccountControls({ user, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? '');
  const [mobile, setMobile] = useState(user.mobileE164 ?? '');
  const [email, setEmail] = useState(user.notificationEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const suspended = user.status === 'suspended';

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateAccount(user.id, {
        name: name.trim() || undefined,
        mobile: mobile.trim() || undefined,
        // Empty clears the address; the server switches the email channel off
        // with it so the two can't disagree.
        notificationEmail: email.trim() === '' ? null : email.trim(),
      });
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSuspend = async () => {
    if (suspended) {
      setBusy(true);
      try { await api.unsuspendUser(user.id); await onChanged(); } finally { setBusy(false); }
      return;
    }
    const reason = window.prompt('سبب التعليق (إلزامي):');
    if (!reason || !reason.trim()) return;
    const note = window.prompt('ملاحظة إضافية (اختياري):') || undefined;
    setBusy(true);
    try { await api.suspendUser(user.id, reason.trim(), note); await onChanged(); } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" />
        <input style={{ ...input, fontFamily: 'var(--font-latin)', direction: 'ltr', textAlign: 'left' }} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665…" />
        <input style={{ ...input, fontFamily: 'var(--font-latin)', direction: 'ltr', textAlign: 'left' }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email (اختياري)" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled={busy}
            onClick={save}
            style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '5px 11px', fontFamily: 'var(--font-arabic)', fontSize: '11px', cursor: 'pointer' }}
          >
            {busy ? '…' : 'حفظ'}
          </button>
          <button onClick={() => { setEditing(false); setError(null); }} style={linkBtn}>إلغاء</button>
        </div>
        {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button onClick={() => setEditing(true)} style={linkBtn}>تحرير</button>
      <button
        disabled={busy}
        onClick={toggleSuspend}
        style={{ ...linkBtn, color: suspended ? 'var(--lime)' : 'var(--coral)' }}
      >
        {suspended ? 'إعادة التفعيل' : 'تعطيل'}
      </button>
    </div>
  );
}
