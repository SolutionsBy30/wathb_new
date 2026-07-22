import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Supervisors() {
  const [items, setItems] = useState([]);

  useEffect(() => { api.listSupervisors().then(setItems); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>المشرفون — {items.length}</h1>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>الجوال</th>
              <th style={th}>الصفة</th>
              <th style={th}>الطلاب المرتبطون</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.supervisorId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{s.mobile}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{s.type === 'parent' ? 'ولي أمر' : 'معلّم'}</span></td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
                    {s.students.length === 0 ? '—' : s.students.map((st) => `${st.name}${st.accepted ? '' : ' (بانتظار القبول)'}`).join('، ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا يوجد مشرفون.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
