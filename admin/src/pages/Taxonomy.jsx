import { useEffect, useRef, useState } from 'react';
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

const LANGUAGE_LABEL = { ar: 'عربي', en: 'English' };

// ADM-013 — native HTML5 drag-and-drop (no library — this is the only
// reorderable list in the app, doesn't justify a dependency). Persists by
// writing each sibling's new `sort` (0..n-1) after a drop; the caller
// supplies the per-item update function since sections/areas/labels hit
// different endpoints.
function DragHandle() {
  return <span style={{ cursor: 'grab', color: 'var(--mist)', fontSize: '13px', userSelect: 'none' }}>⠿</span>;
}

function useDragReorder(items, onPersist) {
  const dragIndex = useRef(null);
  const onDragStart = (i) => { dragIndex.current = i; };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = async (i) => {
    if (dragIndex.current === null || dragIndex.current === i) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(i, 0, moved);
    dragIndex.current = null;
    await onPersist(reordered);
  };
  return { onDragStart, onDragOver, onDrop };
}

// ADM-012 — a small dedicated form (not the generic InlineAdd) since test
// creation needs the extra language selector the other taxonomy levels don't.
function NewTestForm({ onAdd, onCancel }) {
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [language, setLanguage] = useState('ar');
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input style={input} placeholder="اسم الاختبار (عربي)" value={ar} onChange={(e) => setAr(e.target.value)} />
      <input style={input} placeholder="Test name (EN)" value={en} onChange={(e) => setEn(e.target.value)} />
      <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ ...input, width: 'auto' }}>
        <option value="ar">عربي (RTL)</option>
        <option value="en">English (LTR)</option>
      </select>
      <button
        disabled={!ar.trim() || !en.trim()}
        onClick={async () => { await onAdd(ar.trim(), en.trim(), language); setAr(''); setEn(''); }}
        style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'var(--font-arabic)', fontSize: '11px', cursor: 'pointer' }}
      >
        حفظ
      </button>
      <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px' }}>إلغاء</button>
    </div>
  );
}

function LabelPill({ label: l, index, labels, persistOrder, onReload }) {
  const { onDragStart, onDragOver, onDrop } = useDragReorder(labels, persistOrder);
  const retire = async () => {
    const res = await api.retireLabel(l.id);
    if (res.activeQuestionsNeedingReassignment > 0) {
      window.alert(`تم إيقاف التصنيف. يوجد ${res.activeQuestionsNeedingReassignment} سؤالاً نشطاً يجب إعادة تصنيفه أو إيقافه معه.`);
    }
    await onReload();
  };
  return (
    <span
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontFamily: 'var(--font-arabic)', fontSize: '11px', color: l.isRetired ? 'var(--mist)' : 'var(--sand)',
        background: 'var(--indigo)', padding: '5px 10px', borderRadius: '999px',
        textDecoration: l.isRetired ? 'line-through' : 'none',
      }}
    >
      <DragHandle />
      {l.nameAr} · {l.defaultTimeLimitS}ث
      {!l.isRetired && (
        <button onClick={retire} title="إيقاف التصنيف" style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>×</button>
      )}
    </span>
  );
}

function AreaBlock({ area, index, areas, persistAreasOrder, testId, onReload }) {
  const { onDragStart, onDragOver, onDrop } = useDragReorder(areas, persistAreasOrder);
  const persistLabelsOrder = async (reordered) => {
    await Promise.all(reordered.map((l, i) => api.updateLabel(l.id, { sort: i })));
    await onReload();
  };
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      style={{ borderInlineStart: '2px solid var(--on-indigo-line)', paddingInlineStart: '12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...label13, display: 'flex', alignItems: 'center', gap: '6px' }}><DragHandle />{area.nameAr}</span>
        {area.appliesToTracks?.length > 0 && (
          <span style={{ fontSize: '10px', color: 'var(--lime)' }}>{area.appliesToTracks.join(', ')}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', marginBottom: '6px' }}>
        {area.labels.map((l, i) => (
          <LabelPill key={l.id} label={l} index={i} labels={area.labels} persistOrder={persistLabelsOrder} onReload={onReload} />
        ))}
      </div>
      <InlineAdd placeholder1="اسم التصنيف (عربي)" placeholder2="Label name (EN)" onAdd={async (ar, en) => { await api.createLabel(area.id, { nameAr: ar, nameEn: en }); await onReload(); }} />
    </div>
  );
}

function SectionCard({ section, index, sections, persistSectionsOrder, onReload }) {
  const { onDragStart, onDragOver, onDrop } = useDragReorder(sections, persistSectionsOrder);
  const persistAreasOrder = async (reordered) => {
    await Promise.all(reordered.map((a, i) => api.updateArea(a.id, { sort: i })));
    await onReload();
  };
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      style={card}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ ...label13, fontWeight: 500, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DragHandle />{section.nameAr} <span style={{ color: 'var(--mist)', fontSize: '11px' }}>· وزن {section.weight}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingInlineStart: '16px' }}>
        {section.areas.map((area, i) => (
          <AreaBlock key={area.id} area={area} index={i} areas={section.areas} persistAreasOrder={persistAreasOrder} onReload={onReload} />
        ))}
        <InlineAdd placeholder1="اسم المجال (عربي)" placeholder2="Area name (EN)" onAdd={async (ar, en) => { await api.createArea(section.id, { nameAr: ar, nameEn: en }); await onReload(); }} />
      </div>
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
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {t.nameAr}
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '10px', opacity: 0.7 }}>{LANGUAGE_LABEL[t.language] ?? t.language}</span>
          </button>
        ))}
        {!newTestOpen && (
          <button onClick={() => setNewTestOpen(true)} style={{ border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            + اختبار جديد
          </button>
        )}
        {newTestOpen && (
          <NewTestForm
            onAdd={async (ar, en, language) => {
              const created = await api.createTest({ nameAr: ar, nameEn: en, language });
              await onTestsChanged();
              setTestId(created.id);
              setNewTestOpen(false);
            }}
            onCancel={() => setNewTestOpen(false)}
          />
        )}
      </div>

      {!tree && <p style={label13}>اختر اختباراً لعرض التصنيف.</p>}

      {tree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>اسحب ⠿ لإعادة الترتيب.</p>
          {tree.sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              index={i}
              sections={tree.sections}
              persistSectionsOrder={async (reordered) => {
                await Promise.all(reordered.map((s, j) => api.updateSection(s.id, { sort: j })));
                await reload();
              }}
              onReload={reload}
            />
          ))}
          <div style={card}>
            <InlineAdd placeholder1="اسم القسم (عربي)" placeholder2="Section name (EN)" onAdd={async (ar, en) => { await api.createSection(testId, { nameAr: ar, nameEn: en }); await reload(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
