import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AccountControls from '../components/AccountControls';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function SortHeader({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  return (
    <th style={th}>
      <button
        onClick={() => onSort(field)}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: active ? 'var(--sand)' : 'var(--mist)' }}
      >
        {label}
        {active && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

/**
 * STU-034 — one roster table. Rendered once when flat and once per test
 * when grouped, so the two views cannot drift apart in columns or markup.
 */
function StudentTable({ rows, sortBy, sortDir, onSort, onOpenStudent, load }) {
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
            <SortHeader label="الاسم" field="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th style={th}>الجوال</th>
            <th style={th}>المدرسة</th>
            <th style={th}>الاختبارات</th>
            <th style={th}>الأسئلة المكتملة</th>
            <th style={th}>السلسلة</th>
            <SortHeader label="المستوى العام" field="performance" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="نهاية الاشتراك" field="subscriptionEnd" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th style={th}>الحالة</th>
            <th style={th}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.userId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
              <td style={{ ...td, cursor: 'pointer' }} onClick={() => onOpenStudent(s.userId)}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', textDecoration: 'underline' }}>{s.user.name}</span>
              </td>
              <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{s.user.mobileE164}</span></td>
              <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.school?.nameAr ?? '—'}</span></td>
              <td style={td}>
                {/* STU-034 — every test this student has switched on, not just
                    the focused one, so the roster shows who is preparing for
                    more than one thing. */}
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                  {(s.studentTests ?? []).length === 0
                    ? '—'
                    : (s.studentTests ?? []).map((r) => r.test?.nameAr).filter(Boolean).join('، ')}
                </span>
              </td>
              <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{s._count?.answers ?? '—'}</span></td>
              <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--lime)' }}>{s.currentStreak}</span></td>
              <td style={td}>
                {s.compositeIndex == null ? (
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>قيد الجمع</span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{s.compositeIndex}</span>
                )}
              </td>
              <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{fmtDate(s.subscriptionEnd)}</span></td>
              <td style={td}>
                <span
                  title={s.user.status === 'suspended' ? (s.user.suspendReason ?? '') : undefined}
                  style={{
                    fontFamily: 'var(--font-arabic)', fontSize: '12px',
                    color: s.user.status === 'suspended' ? 'var(--coral)' : 'var(--teal-ink)',
                  }}
                >
                  {s.user.status === 'suspended' ? 'معلّق' : 'نشط'}
                </span>
              </td>
              <td style={td}>
                {/* ADM-086 — edit + disable, shared with the supervisors table. */}
                <AccountControls user={{ ...s.user, id: s.userId }} onChanged={load} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا يوجد طلاب.</p>}
    </div>
  );
}

export default function Students({ onOpenStudent }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [cities, setCities] = useState([]);
  const [schools, setSchools] = useState([]);
  const [cityId, setCityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  // STU-034 — group the roster by the tests students are preparing for.
  const [groupByTest, setGroupByTest] = useState(false);
  const [testFilter, setTestFilter] = useState('');
  const [tests, setTests] = useState([]);

  const load = () => api.listStudents({ search, sortBy, sortDir, cityId: cityId || undefined, schoolId: schoolId || undefined }).then((r) => { setItems(r.items); setTotal(r.total); });
  useEffect(() => { load(); }, [sortBy, sortDir, cityId, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.listCities().then(setCities).catch(() => {}); }, []);
  useEffect(() => { api.listTests().then(setTests).catch(() => setTests([])); }, []);
  useEffect(() => { api.listSchools(cityId || undefined).then(setSchools).catch(() => {}); setSchoolId(''); }, [cityId]);

  const onSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir(field === 'name' ? 'asc' : 'desc'); }
  };

  // STU-034 — filter by a test the student is preparing for, and optionally
  // split the roster into one table per test. A student preparing for two
  // tests appears under both, which is the honest rendering of "grouped by
  // the tests they added" — deduplicating would hide half their preparation.
  const activeTestsOf = (s) => (s.studentTests ?? []).map((r) => r.test).filter(Boolean);
  const visible = testFilter
    ? items.filter((s) => activeTestsOf(s).some((t) => t.id === testFilter))
    : items;

  const sections = (() => {
    if (!groupByTest) return [{ key: 'all', label: null, items: visible }];
    const byTest = new Map();
    const none = [];
    for (const s of visible) {
      const ts = activeTestsOf(s);
      if (ts.length === 0) { none.push(s); continue; }
      for (const t of ts) {
        if (!byTest.has(t.id)) byTest.set(t.id, { key: t.id, label: t.nameAr, items: [] });
        byTest.get(t.id).items.push(s);
      }
    }
    const out = [...byTest.values()].sort((a, b) => b.items.length - a.items.length);
    // Students preparing for nothing are the ones worth chasing, so they get
    // a section rather than dropping out of the list entirely.
    if (none.length) out.push({ key: 'none', label: 'بلا اختبار مفعّل', items: none });
    return out;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الطلاب — {total}</h1>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="بحث بالاسم أو الجوال"
          style={{ flex: 1, minWidth: '200px', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        />
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          <option value="">كل المدن</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          <option value="">كل المدارس</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
        </select>
        <select
          value={testFilter}
          onChange={(e) => setTestFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          <option value="">كل الاختبارات</option>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', cursor: 'pointer' }}>
          <input type="checkbox" checked={groupByTest} onChange={(e) => setGroupByTest(e.target.checked)} />
          تجميع حسب الاختبار
        </label>
        <button onClick={load} style={{ border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>بحث</button>
      </div>

      {sections.map((sec) => (
        <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sec.label && (
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: sec.key === 'none' ? '#E8C547' : 'var(--sand)' }}>
              {sec.label} <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>({sec.items.length})</span>
            </span>
          )}
          <StudentTable
            rows={sec.items}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={onSort}
            onOpenStudent={onOpenStudent}
            load={load}
          />
        </div>
      ))}
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
