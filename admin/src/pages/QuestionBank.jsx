import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const STATUS_LABEL = { draft: 'مسودة', in_review: 'قيد المراجعة', published: 'منشور', retired: 'متقاعد' };
const STATUS_COLOR = { draft: 'var(--mist)', in_review: 'var(--lime)', published: 'var(--teal-ink)', retired: 'var(--coral)' };

export default function QuestionBank({ tests, onEdit, onNew }) {
  const [testId, setTestId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ total: 0, items: [] });
  const [selected, setSelected] = useState(new Set());

  const load = async () => {
    const res = await api.listQuestions({ testId, status, search, limit: 100 });
    setData(res);
    setSelected(new Set());
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [testId, status]);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkRetire = async () => {
    if (selected.size === 0) return;
    await api.bulkRetire([...selected]);
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>بنك الأسئلة</h1>
        <Button variant="primary" onClick={onNew}>+ سؤال جديد</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={testId} onChange={(e) => setTestId(e.target.value)} style={selectStyle}>
          <option value="">كل الاختبارات</option>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="بحث في نص السؤال…"
          style={{ ...selectStyle, minWidth: '220px' }}
        />
        <button onClick={load} style={{ border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>بحث</button>
        {selected.size > 0 && (
          <button onClick={bulkRetire} style={{ border: 'none', background: 'var(--coral)', color: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            تقاعد ({selected.size})
          </button>
        )}
        <span style={{ marginInlineStart: 'auto', fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{data.total} سؤال</span>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}></th>
              <th style={th}>السؤال</th>
              <th style={th}>التصنيف</th>
              <th style={th}>الصعوبة</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((q) => (
              <tr key={q.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
                </td>
                <td style={{ ...td, cursor: 'pointer', maxWidth: '360px' }} onClick={() => onEdit(q.id)}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
                    {(q.versions[0]?.stem ?? '').slice(0, 70)}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                    {q.label?.area?.section?.test?.nameAr} · {q.label?.area?.nameAr} · {q.label?.nameAr}
                  </span>
                </td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{q.difficulty}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: STATUS_COLOR[q.status] }}>{STATUS_LABEL[q.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد أسئلة مطابقة.</p>
        )}
      </div>
    </div>
  );
}

const selectStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const th = { padding: '10px 12px' };
const td = { padding: '10px 12px', verticalAlign: 'top' };
