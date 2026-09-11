import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h2 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' };
const th = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const fmt = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/**
 * COM — سلامة الإرسال.
 *
 * One screen for the three things that decide whether our WhatsApp number
 * stays alive: how much of today's allowance is spent, which numbers we have
 * stopped messaging, and which ones the vendor says are not on WhatsApp at all.
 */
export default function SendingHygiene() {
  const [budget, setBudget] = useState(null);
  const [suppressed, setSuppressed] = useState([]);
  const [unreachable, setUnreachable] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const [b, s, u] = await Promise.all([
        api.sendingBudget(),
        api.listSuppressed(),
        api.listUnreachable().catch(() => []),
      ]);
      setBudget(b);
      setSuppressed(s);
      setUnreachable(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clear = async (userId) => {
    setBusy(true);
    setError(null);
    try {
      await api.clearSuppression(userId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const used = budget && budget.cap !== null ? Math.min(1, budget.sentToday / budget.cap) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && <p style={{ ...label, color: 'var(--coral)', margin: 0 }}>{error}</p>}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={h2}>حصة اليوم</h2>
          <button onClick={load} disabled={busy} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
            {busy ? '…' : 'تحديث'}
          </button>
        </div>
        {budget && (budget.cap === null ? (
          <span style={label}>
            لا يوجد حد يومي مضبوط — أُرسلت {budget.sentToday} رسالة اليوم. اضبط الحد من إعدادات المُرسِل.
          </span>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '24px', color: 'var(--sand)' }}>
                {budget.sentToday} / {budget.cap}
              </span>
              {budget.senderLabel && <span style={label}>{budget.senderLabel}</span>}
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--indigo)', overflow: 'hidden' }}>
              <div style={{ width: `${used * 100}%`, height: '100%', background: used >= 1 ? 'var(--coral)' : 'var(--teal)' }} />
            </div>
            {/* The cap stopping a run is a normal, healthy outcome — but it
                does mean some students hear nothing today, so say it plainly. */}
            {!budget.withinCap && (
              <span style={{ ...label, color: 'var(--coral)' }}>
                بلغت الحد اليومي — الرسائل المتبقية ستُرسل غدًا، أو الآن إذا رفعت الحد.
              </span>
            )}
          </>
        ))}
      </div>

      <div style={card}>
        <h2 style={h2}>أرقام أُوقف الإرسال إليها ({suppressed.length})</h2>
        <span style={label}>
          تُوقف تلقائيًا بعد أيام متتالية دون توصيل. الاستمرار في مراسلة رقم لا يستقبل هو أكثر ما يعرّض الرقم المُرسِل للحظر.
        </span>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>الاسم</th>
              <th style={th}>الرقم</th>
              <th style={th}>أيام الإخفاق</th>
              <th style={th}>أُوقف في</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {suppressed.map((u) => (
              <tr key={u.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>{u.name}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)' }} dir="ltr">{u.mobileE164 ?? '—'}</td>
                <td style={td}>{u.whatsappFailedRuns}</td>
                <td style={td}>{fmt(u.whatsappSuppressedAt)}</td>
                <td style={td}>
                  <button onClick={() => clear(u.id)} disabled={busy} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
                    استئناف الإرسال
                  </button>
                </td>
              </tr>
            ))}
            {suppressed.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={5}>لا توجد أرقام موقوفة.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {unreachable.length > 0 && (
        <div style={card}>
          <h2 style={h2}>أرقام ليست على واتساب ({unreachable.length})</h2>
          <span style={label}>نتيجة فحص الرقم عند التسجيل. راجعها مع الطالب قبل أن تستهلك أيام المحاولات.</span>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>الاسم</th>
                <th style={th}>الرقم</th>
                <th style={th}>فُحص في</th>
              </tr>
            </thead>
            <tbody>
              {unreachable.map((u) => (
                <tr key={u.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                  <td style={td}>{u.name}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-latin)' }} dir="ltr">{u.mobileE164 ?? '—'}</td>
                  <td style={td}>{fmt(u.whatsappCheckedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
