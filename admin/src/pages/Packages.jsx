import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };

function halalasToSar(h) {
  return (h / 100).toFixed(2);
}

function NewPackageForm({ tests, onCreated }) {
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [testIds, setTestIds] = useState([]);
  const [durationMonths, setDurationMonths] = useState(1);
  const [priceSar, setPriceSar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggleTest = (id) => setTestIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
    if (!nameAr.trim() || !nameEn.trim() || testIds.length === 0 || !priceSar) return setError('املأ جميع الحقول واختر اختباراً واحداً على الأقل.');
    setBusy(true);
    try {
      await api.createPackage({
        nameAr: nameAr.trim(), nameEn: nameEn.trim(), testIds,
        durationMonths: Number(durationMonths), priceHalalas: Math.round(Number(priceSar) * 100),
      });
      setNameAr(''); setNameEn(''); setTestIds([]); setDurationMonths(1); setPriceSar('');
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>باقة جديدة</h2>
      <input style={fieldStyle} placeholder="الاسم (عربي)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      <input style={fieldStyle} placeholder="Name (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => toggleTest(t.id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px',
              background: testIds.includes(t.id) ? 'var(--lime)' : 'var(--indigo)', color: testIds.includes(t.id) ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.nameAr}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={{ ...fieldStyle, flex: 1 }} type="number" min={1} placeholder="المدة (أشهر)" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
        <input style={{ ...fieldStyle, flex: 1 }} type="number" min={0} step="0.01" placeholder="السعر (ريال، شامل الضريبة)" value={priceSar} onChange={(e) => setPriceSar(e.target.value)} />
      </div>
      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
      <Button variant="primary" disabled={busy} onClick={submit}>{busy ? 'جاري الحفظ…' : 'إنشاء الباقة'}</Button>
    </div>
  );
}

export default function Packages({ tests }) {
  const [packages, setPackages] = useState([]);

  const load = () => api.listPackages().then(setPackages);
  useEffect(() => { load(); }, []);

  const toggleActive = async (pkg) => {
    await api.updatePackage(pkg.id, { isActive: !pkg.isActive });
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الباقات والتسعير</h1>

      <NewPackageForm tests={tests} onCreated={load} />

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>المدة</th>
              <th style={th}>السعر (شامل الضريبة)</th>
              <th style={th}>الاختبارات</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{p.nameAr}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{p.durationMonths} شهر</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{halalasToSar(p.priceHalalas)} ريال</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{p.testIds.length}</span></td>
                <td style={td}>
                  <button
                    onClick={() => toggleActive(p)}
                    style={{ border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: p.isActive ? 'var(--teal-ink)' : 'var(--coral)' }}
                  >
                    {p.isActive ? 'فعّالة' : 'موقوفة'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {packages.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد باقات بعد.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
