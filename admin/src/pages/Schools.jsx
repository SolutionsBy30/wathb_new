import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const th = { textAlign: 'start', padding: '9px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', whiteSpace: 'nowrap' };
const td = { padding: '9px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

export const DISCLOSURE = {
  none: { text: 'مجهول', color: 'var(--teal)' },
  consented: { text: 'بموافقة الطالب', color: 'var(--lime)' },
  full: { text: 'كشف كامل', color: 'var(--coral)' },
};

const STATUS = { approved: 'معتمدة', pending: 'بانتظار المراجعة', rejected: 'مرفوضة' };

/**
 * SCH-008 — the schools registry.
 *
 * Split out of الجغرافيا, which had grown into two unrelated jobs: maintaining
 * the region/city tree, and looking after individual schools. They are used by
 * different people on different days, so they are now different screens.
 *
 * Sorted so the schools that need a decision surface first — pending review,
 * then schools carrying students but no dashboard administrator, which is the
 * common "we onboarded them and forgot the login" case.
 */
export default function Schools({ onOpenSchool }) {
  const [rows, setRows] = useState([]);
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('attention');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const [comparing, setComparing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => { api.listRegions().then(setRegions).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      api.adminListSchools({ search, regionId })
        .then((d) => { if (!cancelled) { setRows(d); setError(null); } })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, regionId, reloadKey]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === 'students') return copy.sort((a, b) => b.students - a.students);
    if (sort === 'name') return copy.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
    // 'attention': pending first, then students-without-an-admin, then by size.
    return copy.sort((a, b) => {
      const rank = (s) => (s.status !== 'approved' ? 0 : s.students > 0 && s.admins === 0 ? 1 : 2);
      return rank(a) - rank(b) || b.students - a.students;
    });
  }, [rows, sort]);

  const totals = useMemo(() => ({
    schools: rows.length,
    students: rows.reduce((n, r) => n + r.students, 0),
    withAdmin: rows.filter((r) => r.admins > 0).length,
    disclosing: rows.filter((r) => r.disclosure !== 'none').length,
  }), [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>المدارس</h1>

      <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
        {[
          ['المدارس', totals.schools],
          ['الطلاب المرتبطون', totals.students],
          ['لديها لوحة', totals.withAdmin],
          ['تكشف الأسماء', totals.disclosing],
        ].map(([t, v]) => (
          <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={label}>{t}</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', color: 'var(--sand)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input style={{ ...fieldStyle, minWidth: '220px' }} placeholder="ابحث باسم المدرسة" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={fieldStyle} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">كل المناطق</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
        </select>
        <select style={fieldStyle} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="attention">ما يحتاج انتباهًا أولًا</option>
          <option value="students">الأكثر طلابًا</option>
          <option value="name">أبجديًا</option>
        </select>
        <button
          onClick={() => setAdding((v) => !v)}
          style={{ border: 'none', cursor: 'pointer', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          {adding ? 'إلغاء' : 'إضافة مدرسة'}
        </button>
        {compareIds.size >= 2 && (
          <button
            onClick={() => setComparing(true)}
            style={{ border: 'none', cursor: 'pointer', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          >
            قارن المحدد ({compareIds.size})
          </button>
        )}
        {compareIds.size > 0 && (
          <button
            onClick={() => { setCompareIds(new Set()); setComparing(false); }}
            style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          >
            مسح التحديد
          </button>
        )}
        {busy && <span style={{ ...label, alignSelf: 'center' }}>جارٍ التحميل…</span>}
      </div>

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}

      {adding && <AddSchoolForm regions={regions} onAdded={() => { setAdding(false); setReloadKey((k) => k + 1); }} />}

      {comparing && <ComparisonView ids={[...compareIds]} onClear={() => setComparing(false)} />}

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '4px 8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '32px' }} />
              <th style={th}>المدرسة</th>
              <th style={th}>المدينة</th>
              <th style={th}>المنطقة</th>
              <th style={th}>الطلاب</th>
              <th style={th}>لوحة المدرسة</th>
              <th style={th}>مستوى الكشف</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpenSchool(s.id)}
                style={{ borderTop: '0.5px solid var(--on-indigo-line)', cursor: 'pointer' }}
              >
                <td style={td} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={compareIds.has(s.id)} onChange={() => toggleCompare(s.id)} title="أضف إلى المقارنة" />
                </td>
                <td style={{ ...td, color: 'var(--lime-print)' }}>{s.nameAr}</td>
                <td style={{ ...td, color: 'var(--mist)' }}>{s.cityNameAr}</td>
                <td style={{ ...td, color: 'var(--mist)' }}>{s.regionNameAr}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)' }}>{s.students}</td>
                <td style={td}>
                  {s.admins > 0 ? (
                    <span style={{ fontFamily: 'var(--font-latin)' }}>{s.admins}</span>
                  ) : s.students > 0 ? (
                    // Worth flagging: a school whose students are being
                    // measured while nobody there can see the result.
                    <span style={{ color: '#E8C547' }}>لا أحد</span>
                  ) : (
                    <span style={{ color: 'var(--mist)' }}>—</span>
                  )}
                </td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i style={{ width: '8px', height: '8px', borderRadius: '999px', background: DISCLOSURE[s.disclosure].color, display: 'inline-block' }} />
                    {DISCLOSURE[s.disclosure].text}
                  </span>
                </td>
                <td style={{ ...td, color: s.status === 'approved' ? 'var(--mist)' : '#E8C547' }}>{STATUS[s.status] ?? s.status}</td>
              </tr>
            ))}
            {sorted.length === 0 && !busy && (
              <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={8}>لا مدارس مطابقة.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ADM-062 — accuracy-by-area profiles for several schools side by side.
// Deliberately not a ranking table: the point is to see where two cohorts
// differ, not to score schools against each other.
function ComparisonView({ ids, onClear }) {
  const [reports, setReports] = useState(null);
  useEffect(() => { setReports(null); api.compareCohorts('school', ids).then(setReports).catch(() => setReports([])); }, [ids.join(',')]);

  if (!reports) return <p style={label}>جاري التحميل…</p>;

  const allAreas = new Map();
  for (const r of reports) {
    if (r.gated) continue;
    for (const a of r.accuracyByArea) if (!allAreas.has(a.areaId)) allAreas.set(a.areaId, a.nameAr);
  }

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>مقارنة ({reports.length})</h3>
        <button onClick={onClear} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', ...label }}>إغلاق</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>المجال</th>
              {reports.map((r) => <th key={r.cohortId} style={{ ...th, textAlign: 'center' }}>{r.nameAr}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...allAreas.entries()].map(([areaId, nameAr]) => (
              <tr key={areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>{nameAr}</td>
                {reports.map((r) => {
                  const a = r.gated ? null : r.accuracyByArea.find((x) => x.areaId === areaId);
                  return (
                    <td key={r.cohortId} style={{ ...td, textAlign: 'center' }}>
                      {r.gated || a?.collecting || !a ? (
                        <span style={label}>قيد الجمع</span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-latin)', color: 'var(--teal-ink)' }}>{Math.round(a.accuracy * 100)}%</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {allAreas.size === 0 && (
              <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={reports.length + 1}>لا مدرسة من المحددة بلغت الحد الأدنى لعرض النسب.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddSchoolForm({ regions, onAdded }) {
  const [regionId, setRegionId] = useState('');
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onRegionChange = async (id) => {
    setRegionId(id);
    setCityId('');
    setCities(id ? await api.listCities(id) : []);
  };

  const submit = async () => {
    if (!cityId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createSchool({ cityId, nameAr: name.trim() });
      setName('');
      onAdded();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={regionId} onChange={(e) => onRegionChange(e.target.value)} style={fieldStyle}>
        <option value="">اختر المنطقة</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
      </select>
      <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={fieldStyle} disabled={!regionId}>
        <option value="">اختر المدينة</option>
        {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
      </select>
      <input style={{ ...fieldStyle, minWidth: '200px' }} placeholder="اسم المدرسة" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        disabled={busy || !cityId || !name.trim()}
        onClick={submit}
        style={{ border: 'none', cursor: 'pointer', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontFamily: 'var(--font-arabic)', fontSize: '13px', opacity: busy || !cityId || !name.trim() ? 0.5 : 1 }}
      >
        {busy ? 'جاري الإضافة…' : 'إضافة'}
      </button>
      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}
