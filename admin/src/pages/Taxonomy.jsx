import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' };
const label13 = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' };
const input = { padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '12px', width: '140px' };

function InlineAdd({ placeholder1, placeholder2, onAdd }) {
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>
        + إضافة
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input style={input} placeholder={placeholder1} value={ar} onChange={(e) => setAr(e.target.value)} />
      <input style={input} placeholder={placeholder2} value={en} onChange={(e) => setEn(e.target.value)} />
      <button
        disabled={!ar.trim() || !en.trim()}
        onClick={async () => { await onAdd(ar.trim(), en.trim()); setAr(''); setEn(''); setOpen(false); }}
        style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'var(--font-arabic)', fontSize: '11px', cursor: 'pointer' }}
      >
        حفظ
      </button>
      <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px' }}>إلغاء</button>
    </div>
  );
}

export default function Taxonomy({ tests, onTestsChanged }) {
  const [testId, setTestId] = useState(null);
  const [tree, setTree] = useState(null);
  const [newTestOpen, setNewTestOpen] = useState(false);

  useEffect(() => {
    if (!testId && tests.length) setTestId(tests[0].id);
  }, [tests, testId]);

  const reload = async () => {
    if (testId) setTree(await api.tree(testId));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [testId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setTestId(t.id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px',
              fontFamily: 'var(--font-arabic)', fontSize: '13px',
              background: testId === t.id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
              color: testId === t.id ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.nameAr}
          </button>
        ))}
        {!newTestOpen && (
          <button onClick={() => setNewTestOpen(true)} style={{ border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            + اختبار جديد
          </button>
        )}
        {newTestOpen && (
          <InlineAdd
            placeholder1="اسم الاختبار (عربي)"
            placeholder2="Test name (EN)"
            onAdd={async (ar, en) => {
              const created = await api.createTest({ nameAr: ar, nameEn: en });
              await onTestsChanged();
              setTestId(created.id);
              setNewTestOpen(false);
            }}
          />
        )}
      </div>

      {!tree && <p style={label13}>اختر اختباراً لعرض التصنيف.</p>}

      {tree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tree.sections.map((section) => (
            <div key={section.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ ...label13, fontWeight: 500, fontSize: '15px' }}>{section.nameAr} <span style={{ color: 'var(--mist)', fontSize: '11px' }}>· وزن {section.weight}</span></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingInlineStart: '16px' }}>
                {section.areas.map((area) => (
                  <div key={area.id} style={{ borderInlineStart: '2px solid var(--on-indigo-line)', paddingInlineStart: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={label13}>{area.nameAr}</span>
                      {area.appliesToTracks?.length > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--lime)' }}>{area.appliesToTracks.join(', ')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', marginBottom: '6px' }}>
                      {area.labels.map((l) => (
                        <span key={l.id} style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: l.isRetired ? 'var(--mist)' : 'var(--sand)', background: 'var(--indigo)', padding: '5px 10px', borderRadius: '999px', textDecoration: l.isRetired ? 'line-through' : 'none' }}>
                          {l.nameAr} · {l.defaultTimeLimitS}ث
                        </span>
                      ))}
                    </div>
                    <InlineAdd placeholder1="اسم التصنيف (عربي)" placeholder2="Label name (EN)" onAdd={async (ar, en) => { await api.createLabel(area.id, { nameAr: ar, nameEn: en }); await reload(); }} />
                  </div>
                ))}
                <InlineAdd placeholder1="اسم المجال (عربي)" placeholder2="Area name (EN)" onAdd={async (ar, en) => { await api.createArea(section.id, { nameAr: ar, nameEn: en }); await reload(); }} />
              </div>
            </div>
          ))}
          <div style={card}>
            <InlineAdd placeholder1="اسم القسم (عربي)" placeholder2="Section name (EN)" onAdd={async (ar, en) => { await api.createSection(testId, { nameAr: ar, nameEn: en }); await reload(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
