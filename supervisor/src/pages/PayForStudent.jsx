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

  useEffect(() => { api.listPackages().then(setPackages).catch(() => {}); }, []);

  const pay = async (packageId) => {
    setBusyId(packageId);
    setError(null);
    try {
      const { checkoutUrl, free } = await api.startCheckoutForStudent(studentId, packageId);
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
