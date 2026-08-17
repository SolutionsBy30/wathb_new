import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const field = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const chip = { border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px' };
const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

/**
 * PAY-011 — promo codes.
 *
 * A code is percent or fixed, optionally scoped to specific packages, and
 * optionally limited by a redemption count and/or a date window. Everything
 * here is a hint for the student-facing check — the server revalidates and
 * reprices at checkout, so nothing on this screen decides what is charged.
 */
function CodeForm({ packages, initial, onSubmit, onCancel, busy }) {
  const isNew = !initial;
  const [code, setCode] = useState(initial?.code ?? '');
  const [kind, setKind] = useState(initial?.kind ?? 'percent');
  // Percent is stored as-is; fixed is stored in halalas but entered in riyals.
  const [value, setValue] = useState(
    initial ? (initial.kind === 'percent' ? String(initial.value) : String(initial.value / 100)) : '',
  );
  const [packageIds, setPackageIds] = useState(initial?.packageIds ?? []);
  const [maxRedemptions, setMaxRedemptions] = useState(initial?.maxRedemptions ?? '');
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? String(initial.startsAt).slice(0, 10) : '');
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? String(initial.expiresAt).slice(0, 10) : '');
  const [error, setError] = useState(null);

  const toggle = (id) => setPackageIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
    const n = Number(value);
    if (!code.trim()) return setError('أدخل رمز الخصم.');
    if (!Number.isFinite(n) || n <= 0) return setError('أدخل قيمة خصم صحيحة.');
    if (kind === 'percent' && (n < 1 || n > 100)) return setError('نسبة الخصم بين ١ و ١٠٠.');
    try {
      await onSubmit({
        code: code.trim(),
        kind,
        value: kind === 'percent' ? Math.round(n) : Math.round(n * 100),
        packageIds,
        maxRedemptions: maxRedemptions === '' ? null : Number(maxRedemptions),
        startsAt: startsAt === '' ? null : startsAt,
        expiresAt: expiresAt === '' ? null : expiresAt,
      });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
        {isNew ? 'رمز خصم جديد' : `تعديل: ${initial.code}`}
      </h2>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          style={{ ...field, flex: 1, minWidth: '150px', fontFamily: 'var(--font-latin)' }}
          dir="ltr"
          placeholder="WATHB20"
          value={code}
          // Uppercased on screen so what the admin sees is what is stored and
          // what a student must type.
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <select style={{ ...field, minWidth: '130px' }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="percent">نسبة مئوية</option>
          <option value="fixed">مبلغ ثابت</option>
        </select>
        <input
          style={{ ...field, width: '120px' }}
          type="number" min={1} step={kind === 'percent' ? 1 : 0.01}
          placeholder={kind === 'percent' ? '٪' : 'ريال'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          الباقات المشمولة — بدون اختيار يشمل كل الباقات
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {packages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              style={{ ...chip, background: packageIds.includes(p.id) ? 'var(--lime)' : 'var(--indigo)', color: packageIds.includes(p.id) ? 'var(--lime-ink)' : 'var(--sand)' }}
            >
              {p.nameAr}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          حد الاستخدام (فارغ = غير محدود)
          <input style={{ ...field, width: '150px' }} type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          يبدأ في
          <input style={{ ...field, fontFamily: 'var(--font-latin)', width: '150px' }} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          ينتهي في
          <input style={{ ...field, fontFamily: 'var(--font-latin)', width: '150px' }} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>

      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button variant="primary" disabled={busy} onClick={submit}>{busy ? 'جاري الحفظ…' : isNew ? 'إنشاء الرمز' : 'حفظ التعديلات'}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>إلغاء</Button>}
      </div>
    </div>
  );
}

export default function DiscountCodes() {
  const [codes, setCodes] = useState(null);
  // Fetched here rather than passed down: this screen is the only consumer,
  // and the package list is needed only to scope a code.
  const [packages, setPackages] = useState([]);
  const [editing, setEditing] = useState(undefined); // undefined none, null new, object edit
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.listDiscountCodes().then(setCodes).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.listPackages().then(setPackages).catch(() => setPackages([]));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setEditing(undefined);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  if (error && !codes) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>;
  if (!codes) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>رموز الخصم</h1>
        {editing === undefined && <Button variant="primary" onClick={() => setEditing(null)}>رمز جديد</Button>}
      </div>

      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}

      {editing === null && (
        <CodeForm packages={packages} busy={busy} onCancel={() => setEditing(undefined)} onSubmit={(dto) => run(() => api.createDiscountCode(dto))} />
      )}
      {editing && (
        <CodeForm packages={packages} initial={editing} busy={busy} onCancel={() => setEditing(undefined)} onSubmit={(dto) => run(() => api.updateDiscountCode(editing.id, dto))} />
      )}

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الرمز</th>
              <th style={th}>الخصم</th>
              <th style={th}>الباقات</th>
              <th style={th}>الاستخدام</th>
              <th style={th}>الصلاحية</th>
              <th style={th}>الحالة</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span dir="ltr" style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }}>{c.code}</span></td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
                    {c.kind === 'percent' ? `${c.value}%` : `${(c.value / 100).toFixed(2)} ريال`}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                    {c.packageIds.length === 0 ? 'كل الباقات' : `${c.packageIds.length} باقة`}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>
                    {c.timesRedeemed}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                    {fmtDate(c.startsAt)} — {fmtDate(c.expiresAt)}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: c.isActive ? 'var(--teal-ink)' : 'var(--coral)' }}>
                    {c.isActive ? 'فعّال' : 'موقوف'}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(c)} style={{ ...chip, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)' }}>تعديل</button>
                    <button
                      disabled={busy}
                      onClick={() => run(() => api.updateDiscountCode(c.id, { isActive: !c.isActive })).catch(() => {})}
                      style={{ ...chip, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: c.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
                    >
                      {c.isActive ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {codes.length === 0 && (
          <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد رموز خصم بعد.</p>
        )}
      </div>
    </div>
  );
}
