import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';

function halalasToSar(h) {
  return (h / 100).toFixed(0);
}

export default function Pricing({ packages, onSubscribe, blockedMessage, onBack }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const subscribe = async (packageId) => {
    setBusyId(packageId);
    setError(null);
    try {
      await onSubscribe(packageId);
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

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {packages.map((p) => (
          <div key={p.id} style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '22px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{p.nameAr}</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '28px', fontWeight: 500, color: 'var(--lime)' }}>
              {halalasToSar(p.priceHalalas)} <span style={{ fontSize: '14px', color: 'var(--mist)' }}>ريال</span>
            </span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>شامل ضريبة القيمة المضافة (15%)</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{p.durationMonths} شهر · {p.questionsPerDay} أسئلة يومياً</span>
            <Button variant="primary" disabled={busyId === p.id} onClick={() => subscribe(p.id)}>
              {busyId === p.id ? 'جاري التحويل…' : 'اشترك الآن'}
            </Button>
          </div>
        ))}
      </div>
      {packages.length === 0 && <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>لا توجد باقات متاحة حالياً.</p>}
    </>
  );
}
