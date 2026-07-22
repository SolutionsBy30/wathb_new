import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' };

function halalasToSar(h) {
  return (h / 100).toFixed(2);
}

export default function Subscriptions() {
  const [gatewayConfigured, setGatewayConfigured] = useState(true);
  const [packages, setPackages] = useState([]);
  const [mobile, setMobile] = useState('+9665');
  const [student, setStudent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [packageId, setPackageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.paymentStatus().then((s) => setGatewayConfigured(s.gatewayConfigured)).catch(() => {});
    api.listPackages().then(setPackages).catch(() => {});
  }, []);

  const search = async () => {
    setError(null);
    setSuccess(null);
    setNotFound(false);
    setStudent(null);
    try {
      const result = await api.searchStudent(mobile.trim());
      if (!result) setNotFound(true);
      else setStudent(result);
    } catch (e) {
      setError(e.message);
    }
  };

  const activate = async () => {
    if (!student || !packageId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const sub = await api.activateViaWireTransfer(student.studentId, packageId);
      setSuccess(sub);
      setStudent({ ...student, latestSubscription: sub });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الاشتراكات</h1>

      {!gatewayConfigured && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderInlineStart: '3px solid var(--lime)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>
            بوابة الدفع الإلكتروني (Paymob) غير مُفعّلة حالياً — يمكنك تفعيل اشتراكات الطلاب يدوياً بعد تأكيد استلام التحويل البنكي عبر النموذج أدناه.
          </p>
        </div>
      )}

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>البحث عن طالب</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={{ ...fieldStyle, flex: 1 }} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665xxxxxxxx" dir="ltr" />
          <Button variant="primary" onClick={search}>بحث</Button>
        </div>
        {notFound && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>لا يوجد طالب بهذا الرقم.</p>}
      </div>

      {student && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '420px' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>{student.name}</p>
            <p style={{ margin: 0, fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{student.mobile}</p>
          </div>

          {student.latestSubscription ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
              آخر اشتراك: {student.latestSubscription.status === 'active' ? 'فعّال' : student.latestSubscription.status} حتى{' '}
              {student.latestSubscription.endsAt ? new Date(student.latestSubscription.endsAt).toLocaleDateString('ar-SA') : '—'}
            </p>
          ) : (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا يوجد اشتراك سابق.</p>
          )}

          <label style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>الباقة</label>
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} style={{ ...fieldStyle, fontFamily: 'var(--font-arabic)' }}>
            <option value="">اختر باقة</option>
            {packages.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.nameAr} — {halalasToSar(p.priceHalalas)} ريال / {p.durationMonths} شهر</option>
            ))}
          </select>

          {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>{error}</p>}
          {success && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)', fontFamily: 'var(--font-arabic)' }}>
              تم تفعيل الاشتراك حتى {new Date(success.endsAt).toLocaleDateString('ar-SA')}.
            </p>
          )}

          <Button variant="primary" disabled={busy || !packageId} onClick={activate}>
            {busy ? 'جاري التفعيل…' : 'تفعيل عبر تحويل بنكي'}
          </Button>
        </div>
      )}
    </div>
  );
}
