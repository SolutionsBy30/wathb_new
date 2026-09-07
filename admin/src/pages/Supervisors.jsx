import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AccountControls from '../components/AccountControls';

export default function Supervisors() {
  const [items, setItems] = useState([]);
  // ADM-098 — the minted link is held only for the supervisor it was minted
  // for, and only until the next one: it is a working credential, so it should
  // not linger on screen behind other rows.
  const [link, setLink] = useState(null); // { supervisorId, url, expiresAt } | { supervisorId, error }
  const [busyId, setBusyId] = useState(null);

  const load = () => api.listSupervisors().then(setItems);
  useEffect(() => { load(); }, []);

  const mintLink = async (supervisorId) => {
    setBusyId(supervisorId);
    setLink(null);
    try {
      const res = await api.mintSupervisorLoginLink(supervisorId);
      setLink({ supervisorId, ...res });
    } catch (e) {
      setLink({ supervisorId, error: e.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>المشرفون — {items.length}</h1>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>الجوال</th>
              <th style={th}>الصفة</th>
              <th style={th}>الطلاب المرتبطون</th>
              <th style={th}>الحالة</th>
              <th style={th}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.supervisorId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{s.mobile}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.type === 'parent' ? 'ولي أمر' : 'معلّم'}</span></td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
                    {s.students.length === 0 ? '—' : s.students.map((st) => `${st.name}${st.accepted ? '' : ' (بانتظار القبول)'}`).join('، ')}
                  </span>
                </td>
                <td style={td}>
                  <span
                    title={s.status === 'suspended' ? (s.suspendReason ?? '') : undefined}
                    style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: s.status === 'suspended' ? 'var(--coral)' : 'var(--teal-ink)' }}
                  >
                    {s.status === 'suspended' ? 'معلّق' : 'نشط'}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* ADM-086 — same controls as the students table. */}
                      <AccountControls
                        user={{ id: s.supervisorId, name: s.name, mobileE164: s.mobile, notificationEmail: s.notificationEmail, status: s.status }}
                        onChanged={load}
                      />
                      {/* ADM-098 — hidden for a suspended account: the API
                          refuses it anyway, and offering a button that can only
                          fail reads as a fault rather than as a rule. */}
                      {s.status !== 'suspended' && (
                        <button
                          onClick={() => mintLink(s.supervisorId)}
                          disabled={busyId === s.supervisorId}
                          title="ينشئ رابط دخول لبوابة هذا المشرف — أرسله إلى رقمه هو فقط"
                          style={{ border: 'none', background: 'var(--indigo)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}
                        >
                          {busyId === s.supervisorId ? '…' : 'رابط الدخول'}
                        </button>
                      )}
                    </div>

                    {link?.supervisorId === s.supervisorId && (
                      link.error ? (
                        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>{link.error}</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '340px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              readOnly
                              value={link.url}
                              onFocus={(e) => e.target.select()}
                              style={{ flex: 1, padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '10px' }}
                            />
                            <button
                              onClick={() => navigator.clipboard?.writeText(link.url)}
                              style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}
                            >
                              نسخ
                            </button>
                          </div>
                          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--coral)', lineHeight: 1.7 }}>
                            هذا الرابط يفتح حساب المشرف مباشرة — أرسله إلى رقمه هو فقط، ولا تضعه في مجموعة. ينتهي خلال ٢٤ ساعة.
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا يوجد مشرفون.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
