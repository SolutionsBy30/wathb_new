import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

function halalasToSar(h) {
  return (h / 100).toFixed(0);
}

// SUP-008 — a supervisor pays on behalf of a linked student. The backend
// re-verifies the accepted/non-revoked link independently (never trust
// the UI alone for who a supervisor can pay for).
export default function PayForStudent({ studentId, studentName, onBack }) {
  const [packages, setPackages] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  // PAY-011 — the supervisor gets the same promo box as the student, priced
  // against every paid package at once so each card shows its own total. The
  // server re-validates and re-prices at checkout, so nothing here decides
  // what is actually charged.
  const [promo, setPromo] = useState('');
  const [promoState, setPromoState] = useState(null); // {ok, message, byPackage}
  const [promoBusy, setPromoBusy] = useState(false);

  useEffect(() => { api.listPackages().then(setPackages).catch(() => {}); }, []);

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoState(null);
    try {
      const paid = packages.filter((p) => p.priceHalalas > 0);
      const results = await Promise.all(paid.map((p) => api.previewPromo(code, p.id).then((r) => [p.id, r])));
      const byPackage = Object.fromEntries(results);
      const anyOk = results.some(([, r]) => r.ok);
      const firstReason = results.find(([, r]) => !r.ok)?.[1]?.message;
      setPromoState({
        ok: anyOk,
        message: anyOk ? 'تم تطبيق رمز الخصم.' : (firstReason ?? 'رمز الخصم غير صحيح.'),
        byPackage,
      });
    } catch (e) {
      setPromoState({ ok: false, message: e.message, byPackage: {} });
    } finally {
      setPromoBusy(false);
    }
  };

  const promoFor = (pkgId) => {
    const r = promoState?.byPackage?.[pkgId];
    return r?.ok ? r : null;
  };

  const pay = async (packageId) => {
    setBusyId(packageId);
    setError(null);
    try {
      // Only send a code that previewed OK for THIS package — sending one the
      // server will reject would fail the whole checkout instead of simply
      // charging full price.
      const { checkoutUrl, free } = await api.startCheckoutForStudent(studentId, packageId, promoFor(packageId) ? promo.trim() : undefined);
      // A zero-price package is already active — no gateway to hand off to,
      // so go straight back to the dashboard instead of redirecting out.
      if (free) {
        setBusyId(null);
        onBack();
        return;
      }
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
        → رجوع
      </button>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>
        الدفع نيابة عن {studentName}
      </h1>
      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={promo}
          onChange={(e) => { setPromo(e.target.value); setPromoState(null); }}
          placeholder="رمز الخصم (اختياري)"
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', minWidth: '180px' }}
        />
        <Button variant="secondary" disabled={promoBusy || !promo.trim()} onClick={applyPromo}>
          {promoBusy ? 'جاري التحقق…' : 'تطبيق'}
        </Button>
        {promoState && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: promoState.ok ? 'var(--teal-ink)' : 'var(--coral)' }}>
            {promoState.message}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {packages.map((p) => (
          <div key={p.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '22px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{p.nameAr}</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '28px', fontWeight: 500, color: 'var(--lime)' }}>
              {halalasToSar(p.priceHalalas)} <span style={{ fontSize: '14px', color: 'var(--mist)' }}>ريال</span>
            </span>
            {/* PAY-010 — same decorated fields the student and landing pages
                read; the supervisor paying on behalf sees the same offer. */}
            {p.compareAtHalalas && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '14px', color: 'var(--mist)', textDecoration: 'line-through' }}>
                  {halalasToSar(p.compareAtHalalas)}
                </span>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime-ink)', background: 'var(--lime)', borderRadius: '999px', padding: '2px 8px' }}>
                  خصم {p.discountPercent}%
                </span>
              </div>
            )}
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{p.durationMonths} شهر · {p.questionsPerDay} أسئلة يومياً</span>
            {promoFor(p.id) && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--teal-ink)' }}>
                بعد الخصم: <span style={{ fontFamily: 'var(--font-latin)' }}>{halalasToSar(promoFor(p.id).totalHalalas)}</span> ريال
              </span>
            )}
            <Button variant="primary" disabled={busyId === p.id} onClick={() => pay(p.id)}>
              {busyId === p.id ? 'جاري التحويل…' : 'ادفع الآن'}
            </Button>
          </div>
        ))}
      </div>
      {packages.length === 0 && <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>لا توجد باقات متاحة حالياً.</p>}
    </div>
  );
}
