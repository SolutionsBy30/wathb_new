import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { api } from '../../../api/client';

function halalasToSar(h) {
  return (h / 100).toFixed(0);
}

export default function Pricing({ packages, onSubscribe, blockedMessage, onBack, currentPackageId }) {
  // PAY-011 — one code applies to whichever package the student then picks.
  // Previewed against a package before charging so the new total is visible
  // before committing; the server re-validates and re-prices at checkout, so
  // nothing here decides what is actually charged.
  const [promo, setPromo] = useState('');
  const [promoState, setPromoState] = useState(null); // {ok, message, byPackage}
  const [promoBusy, setPromoBusy] = useState(false);

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoState(null);
    try {
      // Priced against every package on screen, so each card can show its own
      // discounted total rather than one number that only fits one package.
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

  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const subscribe = async (packageId) => {
    setBusyId(packageId);
    setError(null);
    try {
      // Only send a code that previewed OK for THIS package — sending one
      // the server will reject would fail the whole checkout instead of
      // simply charging full price.
      await onSubscribe(packageId, promoFor(packageId) ? promo.trim() : undefined);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  };

  return (
    <>
      {onBack && (
        <button onClick={onBack} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
          → رجوع
        </button>
      )}
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>
        الباقات
      </h1>
      {blockedMessage && (
        <div style={{ background: 'var(--coral)', color: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '14px 18px', maxWidth: '480px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>{blockedMessage}</p>
        </div>
      )}
      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}

      {/* PAY-011 — one box, applied to every paid package at once, so the
          student sees which of them the code actually covers. */}
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
        {/* --teal-ink is the ink for teal *tints* (light grounds); on this
            dark card it reads as near-black. --teal is the on-dark tone. */}
        {promoState && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: promoState.ok ? 'var(--teal)' : 'var(--coral)' }}>
            {promoState.message}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {packages.map((p) => {
          // Once a code applies to this package, the amount actually charged
          // is the promo total — so that becomes the big number and the list
          // price is demoted to a struck-through reference. Two prices at
          // equal weight would leave the student guessing which one they pay.
          const promo = promoFor(p.id);
          return (
          <div key={p.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '22px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{p.nameAr}</span>
            {p.priceHalalas === 0 ? (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '28px', fontWeight: 500, color: 'var(--lime)' }}>مجاناً</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{
                  fontFamily: 'var(--font-latin)',
                  fontSize: promo ? '17px' : '28px',
                  fontWeight: 500,
                  color: promo ? 'var(--mist)' : 'var(--lime)',
                  textDecoration: promo ? 'line-through' : 'none',
                }}>
                  {halalasToSar(p.priceHalalas)} <span style={{ fontSize: '14px', color: 'var(--mist)' }}>ريال</span>
                </span>
                {promo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>بعد الخصم</span>
                    <span style={{ fontFamily: 'var(--font-latin)', fontSize: '30px', fontWeight: 700, color: 'var(--lime)', lineHeight: 1.15 }}>
                      {halalasToSar(promo.totalHalalas)} <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: 400, color: 'var(--mist)' }}>ريال</span>
                    </span>
                  </div>
                )}
                {/* PAY-010 — only rendered when the API reports a genuine
                    saving; a was-price at or below the real one is dropped
                    server-side rather than shown as "0% off". Hidden once a
                    promo applies, so the card never shows three prices at
                    once — the comparison that matters is then list vs. promo. */}
                {p.compareAtHalalas && !promo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-latin)', fontSize: '14px', color: 'var(--mist)', textDecoration: 'line-through' }}>
                      {halalasToSar(p.compareAtHalalas)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime-ink)', background: 'var(--lime)', borderRadius: '999px', padding: '2px 8px' }}>
                      خصم {p.discountPercent}%
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* VAT wording only makes sense on a charge — there's nothing to tax at zero. */}
            {p.priceHalalas > 0 && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>شامل ضريبة القيمة المضافة (15%)</span>
            )}
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{p.durationMonths} شهر · {p.questionsPerDay} أسئلة يومياً</span>
            <Button variant="primary" disabled={busyId === p.id || p.id === currentPackageId} onClick={() => subscribe(p.id)}>
              {busyId === p.id
                ? (p.priceHalalas === 0 ? 'جاري التفعيل…' : 'جاري التحويل…')
                : p.id === currentPackageId
                  ? 'باقتك الحالية'
                  : currentPackageId
                    ? 'ترقية لهذه الباقة'
                    : (p.priceHalalas === 0 ? 'ابدأ مجاناً' : 'اشترك الآن')}
            </Button>
          </div>
          );
        })}
      </div>
      {packages.length === 0 && <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>لا توجد باقات متاحة حالياً.</p>}
    </>
  );
}
