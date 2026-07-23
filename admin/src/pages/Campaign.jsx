import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };

// ADM-083/NOT-011 — bulk/promotional send to a filtered audience, distinct
// from the existing "send all due" daily job. Preview shows the recipient
// count before anything goes out; send reuses the exact same filter shape.
export default function Campaign() {
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [packages, setPackages] = useState([]);

  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [inactiveDays, setInactiveDays] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('marketing');

  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listRegions().then(setRegions).catch(() => {});
    api.listPackages().then(setPackages).catch(() => {});
  }, []);
  useEffect(() => {
    setCityId('');
    if (regionId) api.listCities(regionId).then(setCities).catch(() => {});
    else setCities([]);
  }, [regionId]);

  const filter = () => ({
    ...(regionId ? { regionId } : {}),
    ...(cityId ? { cityId } : {}),
    ...(packageId ? { packageId } : {}),
    ...(subscriptionStatus ? { subscriptionStatus } : {}),
    ...(inactiveDays ? { inactiveDays: Number(inactiveDays) } : {}),
  });

  const runPreview = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setPreview(await api.previewCampaign(filter()));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runSend = async () => {
    if (!message.trim()) return setError('نص الرسالة مطلوب.');
    setError(null);
    setBusy(true);
    try {
      setResult(await api.sendCampaign({ ...filter(), message: message.trim(), category }));
      setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>إرسال جماعي لجمهور مُصفّى</h2>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} style={fieldStyle}>
          <option value="">كل المناطق</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
        </select>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={!regionId} style={fieldStyle}>
          <option value="">كل المدن</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>
        <select value={packageId} onChange={(e) => setPackageId(e.target.value)} style={fieldStyle}>
          <option value="">كل الباقات</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
        </select>
        <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)} style={fieldStyle}>
          <option value="">كل حالات الاشتراك</option>
          <option value="active">نشط</option>
          <option value="expired">منتهٍ</option>
          <option value="none">بدون اشتراك</option>
        </select>
        <input
          type="number" min={1} value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)}
          placeholder="أيام عدم النشاط (اختياري)" style={{ ...fieldStyle, width: '170px' }}
        />
      </div>

      <textarea
        rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="نص الرسالة…" style={{ ...fieldStyle, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
          <option value="marketing">تسويقية</option>
          <option value="utility">خدمية</option>
        </select>
        <button onClick={runPreview} disabled={busy} style={{ ...fieldStyle, cursor: 'pointer' }}>معاينة عدد المستلمين</button>
        <Button variant="primary" disabled={busy || !preview} onClick={runSend}>{busy ? '…' : `إرسال إلى ${preview?.count ?? 0}`}</Button>
      </div>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}

      {preview && !result && (
        <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
          {preview.count} مستلم مطابق للتصفية.
          {preview.sample.length > 0 && (
            <span> مثال: {preview.sample.map((s) => s.name).join('، ')}</span>
          )}
        </div>
      )}

      {result && (
        <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--teal-ink)' }}>
          أُرسل {result.sent} من {result.targeted} — متوقف عن الإيقاف: {result.optedOut}، سقف يومي: {result.frequencyCapped}، بدون رقم: {result.noMobile}، فشل: {result.failed}. التكلفة التقديرية: {result.costEstimateSar.toFixed(2)} ر.س.
        </div>
      )}
    </div>
  );
}
