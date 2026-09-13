import { useEffect, useState } from 'react';
import { api } from '../api/client';
import GeographyRegistry from './GeographyRegistry';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };

function CohortReport({ type, id, label: title, onClear }) {
  const [report, setReport] = useState(null);
  useEffect(() => { setReport(null); api.cohortReport(type, id).then(setReport); }, [type, id]);
  if (!report) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  if (report.gated) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{title}</h3>
          <button onClick={onClear} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', ...label }}>إغلاق</button>
        </div>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
          {report.studentCount} طالب مشترك مرتبط بهذه الفئة، {report.totalAnswered} إجابة إجمالاً — تحت الحد الأدنى لعرض نسب مئوية
          (15 طالباً و500 إجابة على الأقل). لا تُعرض أي نسبة تحت هذا الحد.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{title}</h3>
        <button onClick={onClear} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', ...label }}>إغلاق</button>
      </div>
      <p style={{ margin: 0, ...label }}>
        {report.studentCount} طالب مشترك في هذه الفئة · {report.totalAnswered} إجابة
      </p>
      {report.accuracyByArea.map((a) => (
        <div key={a.areaId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--sand)', fontFamily: 'var(--font-arabic)' }}>{a.nameAr}</span>
          <span style={{ fontFamily: 'var(--font-latin)', color: a.collecting ? 'var(--mist)' : 'var(--teal-ink)' }}>
            {a.collecting ? 'قيد الجمع' : `${Math.round(a.accuracy * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * ADM-062/063/064 — the geographic registry: regions, cities, and the
 * school-merge tool that repoints enrollments rather than orphaning them.
 *
 * SCH-008 — schools themselves moved to their own screen. This page had grown
 * into two unrelated jobs sharing a scroll: maintaining the region/city tree,
 * and looking after individual schools. Merging stays here because it is a
 * registry repair, not a school-management task — you reach for it when the
 * same school was entered twice.
 *
 * Ordered by how often each part is used: approvals (a daily decision), then
 * the tree with its cohort reports, then registry maintenance, which is rare
 * and destructive enough to belong at the bottom.
 */
export default function Geography({ onOpenSchools }) {
  const [regions, setRegions] = useState([]);
  const [citiesByRegion, setCitiesByRegion] = useState({});
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [pending, setPending] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState(null);

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

  const approve = async (id) => { await api.approveSchool(id); load(); };
  const reject = async (id) => { await api.rejectSchool(id); load(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الجغرافيا</h1>
        <button
          onClick={onOpenSchools}
          style={{ border: 'none', background: 'transparent', color: 'var(--lime-print)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px', padding: 0 }}
        >
          المدارس ←
        </button>
      </div>

      {/* Decisions first: a suggested school blocks a student from finishing
          their profile, so it should not be below three screens of registry. */}
      {pending.length > 0 && (
        <div style={{ ...card, borderInlineStart: '3px solid var(--coral)' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>مدارس بانتظار المراجعة ({pending.length})</h3>
          {pending.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.nameAr} — {s.city?.nameAr}، {s.city?.region?.nameAr}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approve(s.id)} style={{ border: 'none', cursor: 'pointer', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>قبول</button>
                <button onClick={() => reject(s.id)} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>رفض</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: '320px', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
          <p style={{ margin: '8px 12px', ...label }}>اختر منطقة أو مدينة لعرض تقرير الفئة.</p>
          {regions.map((r) => (
            <div key={r.id} style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => toggleRegion(r.id)} style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
                  {expandedRegion === r.id ? '▾' : '◂'} {r.nameAr}
                </button>
                <button onClick={() => setSelectedCohort({ type: 'region', id: r.id, label: `منطقة ${r.nameAr}` })} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lime-print)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>عرض التقرير</button>
              </div>
              {expandedRegion === r.id && (
                <div style={{ marginInlineStart: '16px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(citiesByRegion[r.id] ?? []).map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{c.nameAr}</span>
                      <button onClick={() => setSelectedCohort({ type: 'city', id: c.id, label: `مدينة ${c.nameAr}` })} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lime-print)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}>عرض التقرير</button>
                    </div>
                  ))}
                  {(citiesByRegion[r.id] ?? []).length === 0 && <span style={label}>لا مدن مسجّلة.</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '320px' }}>
          {selectedCohort ? (
            <CohortReport
              type={selectedCohort.type}
              id={selectedCohort.id}
              label={selectedCohort.label}
              onClear={() => setSelectedCohort(null)}
            />
          ) : (
            <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.9 }}>
              تقارير المدارس ومقارنتها انتقلت إلى شاشة «المدارس».
            </p>
          )}
        </div>
      </div>

      <GeographyRegistry />
    </div>
  );
}
