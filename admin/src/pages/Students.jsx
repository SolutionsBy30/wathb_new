import { useEffect, useState } from 'react';
import { api } from '../api/client';

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

export default function Students() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [cities, setCities] = useState([]);
  const [schools, setSchools] = useState([]);
  const [cityId, setCityId] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const load = () => api.listStudents({ search, sortBy, sortDir, cityId: cityId || undefined, schoolId: schoolId || undefined }).then((r) => { setItems(r.items); setTotal(r.total); });
  useEffect(() => { load(); }, [sortBy, sortDir, cityId, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.listCities().then(setCities).catch(() => {}); }, []);
  useEffect(() => { api.listSchools(cityId || undefined).then(setSchools).catch(() => {}); setSchoolId(''); }, [cityId]);

  const onSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir(field === 'name' ? 'asc' : 'desc'); }
  };

  // ADM-085 — required reason, optional note; reversible.
  const toggleSuspend = async (s) => {
    if (s.user.status === 'suspended') {
      await api.unsuspendUser(s.userId);
      load();
      return;
    }
    const reason = window.prompt('سبب التعليق (إلزامي):');
    if (!reason || !reason.trim()) return;
    const note = window.prompt('ملاحظة إضافية (اختياري):') || undefined;
    await api.suspendUser(s.userId, reason.trim(), note);
    load();
  };

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
        <button onClick={load} style={{ border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>بحث</button>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <SortHeader label="الاسم" field="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th style={th}>الجوال</th>
              <th style={th}>المدرسة</th>
              <th style={th}>الأسئلة المكتملة</th>
              <th style={th}>السلسلة</th>
              <SortHeader label="المؤشر المركّب" field="performance" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="نهاية الاشتراك" field="subscriptionEnd" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.userId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.user.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{s.user.mobileE164}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.school?.nameAr ?? '—'}</span></td>
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
                  <button
                    onClick={() => toggleSuspend(s)}
                    title={s.user.status === 'suspended' ? (s.user.suspendReason ?? '') : undefined}
                    style={{
                      border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'var(--font-arabic)', fontSize: '12px',
                      color: s.user.status === 'suspended' ? 'var(--coral)' : 'var(--teal-ink)',
                    }}
                  >
                    {s.user.status === 'suspended' ? 'معلّق — إلغاء التعليق' : 'نشط — تعليق'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا يوجد طلاب.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
