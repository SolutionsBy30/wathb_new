import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import GeographyRegistry from './GeographyRegistry';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };

function CohortReport({ type, id, label }) {
  const [report, setReport] = useState(null);
  useEffect(() => { api.cohortReport(type, id).then(setReport); }, [type, id]);
  if (!report) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  if (report.gated) {
    return (
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{label}</h3>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
          {report.studentCount} طالب مشترك مرتبط بهذه الفئة، {report.totalAnswered} إجابة إجمالاً — تحت الحد الأدنى لعرض نسب مئوية
          (15 طالباً و500 إجابة على الأقل). لا تُعرض أي نسبة تحت هذا الحد.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{label}</h3>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
        {report.studentCount} طالب مشترك في هذه الفئة · {report.totalAnswered} إجابة
      </p>
      {report.accuracyByArea.map((a) => (
        <div key={a.areaId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--sand)' }}>{a.nameAr}</span>
          <span style={{ fontFamily: 'var(--font-latin)', color: a.collecting ? 'var(--mist)' : 'var(--teal-ink)' }}>
            {a.collecting ? 'قيد الجمع' : `${Math.round(a.accuracy * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ADM-062 — school comparison-overlay: accuracy-by-area profiles for
// several schools plotted side by side. Deliberately not a ranking table.
function ComparisonView({ type, ids, onClear }) {
  const [reports, setReports] = useState(null);
  useEffect(() => { api.compareCohorts(type, ids).then(setReports); }, [type, ids]);

  if (!reports) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const allAreas = new Map();
  for (const r of reports) {
    if (r.gated) continue;
    for (const a of r.accuracyByArea) if (!allAreas.has(a.areaId)) allAreas.set(a.areaId, a.nameAr);
  }

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>مقارنة ({reports.length})</h3>
        <button onClick={onClear} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>إغلاق</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'start', padding: '6px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>المجال</th>
              {reports.map((r) => (
                <th key={r.cohortId} style={{ padding: '6px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>{r.nameAr}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...allAreas.entries()].map(([areaId, nameAr]) => (
              <tr key={areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{nameAr}</td>
                {reports.map((r) => {
                  const a = r.gated ? null : r.accuracyByArea.find((x) => x.areaId === areaId);
                  return (
                    <td key={r.cohortId} style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {r.gated ? (
                        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>قيد الجمع</span>
                      ) : a?.collecting ? (
                        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>قيد الجمع</span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--teal-ink)' }}>{Math.round((a?.accuracy ?? 0) * 100)}%</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Geography() {
  const [regions, setRegions] = useState([]);
  const [citiesByRegion, setCitiesByRegion] = useState({});
  const [schoolsByCity, setSchoolsByCity] = useState({});
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [expandedCity, setExpandedCity] = useState(null);
  const [pending, setPending] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [compareIds, setCompareIds] = useState(new Set());
  const [comparing, setComparing] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);

  const toggleCompareSchool = (id) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const load = () => {
    api.listRegions().then(setRegions);
    api.pendingSchools().then(setPending);
  };
  useEffect(() => { load(); }, []);

  const toggleRegion = async (regionId) => {
    if (expandedRegion === regionId) return setExpandedRegion(null);
    setExpandedRegion(regionId);
    if (!citiesByRegion[regionId]) {
      const cities = await api.listCities(regionId);
      setCitiesByRegion((prev) => ({ ...prev, [regionId]: cities }));
    }
  };

  const toggleCity = async (cityId) => {
    if (expandedCity === cityId) return setExpandedCity(null);
    setExpandedCity(cityId);
    if (!schoolsByCity[cityId]) {
      const schools = await api.listSchools(cityId);
      setSchoolsByCity((prev) => ({ ...prev, [cityId]: schools }));
    }
  };

  const approve = async (id) => { await api.approveSchool(id); load(); };
  const reject = async (id) => { await api.rejectSchool(id); load(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الجغرافيا والمدارس</h1>

      {pending.length > 0 && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderInlineStart: '3px solid var(--coral)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>مدارس بانتظار المراجعة ({pending.length})</h3>
          {pending.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.nameAr} — {s.city?.nameAr}، {s.city?.region?.nameAr}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approve(s.id)} style={{ border: 'none', cursor: 'pointer', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>قبول</button>
                <button onClick={() => reject(s.id)} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>رفض</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => setShowRegistry((v) => !v)} style={{ border: 'none', cursor: 'pointer', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
          {showRegistry ? 'إخفاء إدارة السجل' : 'إدارة السجل الجغرافي'}
        </button>
        {compareIds.size >= 2 && (
          <button onClick={() => setComparing(true)} style={{ border: 'none', cursor: 'pointer', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            قارن المحدد ({compareIds.size})
          </button>
        )}
        {compareIds.size > 0 && (
          <button onClick={() => { setCompareIds(new Set()); setComparing(false); }} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>
            مسح التحديد
          </button>
        )}
      </div>

      {showRegistry && <GeographyRegistry />}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
          {regions.map((r) => (
            <div key={r.id} style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => toggleRegion(r.id)} style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>{r.nameAr}</button>
                <button onClick={() => setSelectedCohort({ type: 'region', id: r.id, label: `منطقة ${r.nameAr}` })} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lime-print)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>عرض التقرير</button>
              </div>
              {expandedRegion === r.id && (
                <div style={{ marginInlineStart: '16px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(citiesByRegion[r.id] ?? []).map((c) => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => toggleCity(c.id)} style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{c.nameAr}</button>
                        <button onClick={() => setSelectedCohort({ type: 'city', id: c.id, label: `مدينة ${c.nameAr}` })} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lime-print)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>عرض التقرير</button>
                      </div>
                      {expandedCity === c.id && (
                        <div style={{ marginInlineStart: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(schoolsByCity[c.id] ?? []).map((s) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} title={s.id}>
                                <input type="checkbox" checked={compareIds.has(s.id)} onChange={() => toggleCompareSchool(s.id)} />
                                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{s.nameAr}</span>
                              </label>
                              <button onClick={() => setSelectedCohort({ type: 'school', id: s.id, label: s.nameAr })} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lime-print)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>عرض التقرير</button>
                            </div>
                          ))}
                          {(schoolsByCity[c.id] ?? []).length === 0 && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>لا مدارس مسجّلة.</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '320px' }}>
          {comparing ? (
            <ComparisonView type="school" ids={[...compareIds]} onClear={() => setComparing(false)} />
          ) : selectedCohort ? (
            <CohortReport type={selectedCohort.type} id={selectedCohort.id} label={selectedCohort.label} />
          ) : (
            <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>اختر منطقة أو مدينة أو مدرسة لعرض تقرير الفئة، أو حدّد عدة مدارس بمربعات الاختيار للمقارنة.</p>
          )}
        </div>
      </div>

      <AddSchoolForm regions={regions} onAdded={load} />
    </div>
  );
}

function AddSchoolForm({ regions, onAdded }) {
  const [regionId, setRegionId] = useState('');
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onRegionChange = async (id) => {
    setRegionId(id);
    setCityId('');
    setCities(id ? await api.listCities(id) : []);
  };

  const submit = async () => {
    if (!cityId || !name.trim()) return;
    setBusy(true);
    try {
      await api.createSchool({ cityId, nameAr: name.trim() });
      setName('');
      onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px' }}>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>إضافة مدرسة</h3>
      <select value={regionId} onChange={(e) => onRegionChange(e.target.value)} style={fieldStyle}>
        <option value="">اختر المنطقة</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
      </select>
      <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={fieldStyle} disabled={!regionId}>
        <option value="">اختر المدينة</option>
        {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
      </select>
      <input style={fieldStyle} placeholder="اسم المدرسة" value={name} onChange={(e) => setName(e.target.value)} />
      <Button variant="primary" disabled={busy || !cityId || !name.trim()} onClick={submit}>{busy ? 'جاري الإضافة…' : 'إضافة'}</Button>
    </div>
  );
}
