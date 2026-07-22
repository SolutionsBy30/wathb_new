import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Students() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const load = () => api.listStudents(search).then((r) => { setItems(r.items); setTotal(r.total); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الطلاب — {total}</h1>
      <div style={{ display: 'flex', gap: '8px', maxWidth: '360px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="بحث بالاسم أو الجوال"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        />
        <button onClick={load} style={{ border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>بحث</button>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>الجوال</th>
              <th style={th}>الاختبار المستهدف</th>
              <th style={th}>المدرسة</th>
              <th style={th}>السلسلة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.userId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.user.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{s.user.mobileE164}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.targetTest?.nameAr ?? '—'}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.school?.nameAr ?? '—'}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--lime)' }}>{s.currentStreak}</span></td>
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
