import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import { downloadCsv } from '../lib/csv';

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

/**
 * ADM-014 — rename a section or area in place. The PATCH endpoints have
 * always existed; until now the UI only ever used them to persist drag-
 * reorder, so a typo in a name was uncorrectable without a DB query.
 * `extra` carries the one field sections have and areas don't (weight).
 */
function InlineEdit({ nameAr, nameEn, extra, onSave, onCancel }) {
  const [ar, setAr] = useState(nameAr);
  const [en, setEn] = useState(nameEn);
  const [extraVal, setExtraVal] = useState(extra?.value ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ nameAr: ar.trim(), nameEn: en.trim(), extra: extraVal });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={input} value={ar} onChange={(e) => setAr(e.target.value)} placeholder="الاسم (عربي)" />
        <input style={input} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Name (EN)" />
        {extra && (
          <input
            style={{ ...input, width: '70px' }}
            type="number" step="0.1" min="0"
            value={extraVal}
            onChange={(e) => setExtraVal(e.target.value)}
            title={extra.label}
          />
        )}
        <button
          disabled={busy || !ar.trim() || !en.trim()}
          onClick={save}
          style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'var(--font-arabic)', fontSize: '11px', cursor: 'pointer' }}
        >
          {busy ? '…' : 'حفظ'}
        </button>
        <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px' }}>إلغاء</button>
      </div>
      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}

/**
 * Delete is only ever offered for an empty branch, and the server enforces
 * that independently — a populated section/area is refused with a count,
 * because the cascade would take StudentLabelStat (per-student performance
 * history) with it. The button explains what will disappear so "empty" isn't
 * mistaken for "nothing at all".
 */
function DeleteControl({ what, childCount, childNoun, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirming(false);
    }
  };

  if (error) {
    return (
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', maxWidth: '380px' }}>
        {error} <button onClick={() => setError(null)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px' }}>إخفاء</button>
      </span>
    );
  }
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} title={`حذف ${what}`} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '12px' }}>
        حذف
      </button>
    );
  }
  return (
    <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>
        {childCount > 0 ? `سيُحذف ${childCount} ${childNoun} أيضاً — متأكد؟` : 'تأكيد الحذف؟'}
      </span>
      <button disabled={busy} onClick={run} style={{ border: 'none', background: 'var(--coral)', color: 'var(--indigo)', borderRadius: '999px', padding: '4px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', cursor: 'pointer' }}>
        {busy ? '…' : 'نعم، احذف'}
      </button>
      <button onClick={() => setConfirming(false)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px' }}>إلغاء</button>
    </span>
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

// ADM-095 — a label pill carries the same three actions its parent area does:
// rename, retire (reversible, keeps the history) and delete (only ever
// possible for a label nothing was ever filed under). Editing was previously
// impossible at this level — a typo in a label name could only be fixed by
// retiring it and creating a replacement, which orphaned nothing but left a
// struck-through ghost in the tree forever.
function LabelPill({ label: l, index, labels, persistOrder, onReload }) {
  const { onDragStart, onDragOver, onDrop } = useDragReorder(labels, persistOrder);
  const [editing, setEditing] = useState(false);

  const retire = async () => {
    const res = await api.retireLabel(l.id);
    if (res.activeQuestionsNeedingReassignment > 0) {
      window.alert(`تم إيقاف التصنيف. يوجد ${res.activeQuestionsNeedingReassignment} سؤالاً نشطاً يجب إعادة تصنيفه أو إيقافه معه.`);
    }
    await onReload();
  };

  // Retiring was one-way from this screen, so a mis-click was unrecoverable
  // without database access. isRetired is an ordinary field on the same PATCH.
  const restore = async () => {
    await api.updateLabel(l.id, { isRetired: false });
    await onReload();
  };

  if (editing) {
    return (
      <span style={{ background: 'var(--indigo)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
        <InlineEdit
          nameAr={l.nameAr}
          nameEn={l.nameEn}
          extra={{ label: 'المهلة (ثانية)', value: l.defaultTimeLimitS }}
          onSave={async ({ nameAr, nameEn, extra }) => {
            const seconds = parseInt(extra, 10);
            await api.updateLabel(l.id, {
              nameAr,
              nameEn,
              // Left untouched when the box is blank or not a number, rather
              // than writing NaN over a working time limit.
              ...(Number.isFinite(seconds) && seconds > 0 ? { defaultTimeLimitS: seconds } : {}),
            });
            setEditing(false);
            await onReload();
          }}
          onCancel={() => setEditing(false)}
        />
      </span>
    );
  }

  return (
    <span
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: 'var(--font-arabic)', fontSize: '11px', color: l.isRetired ? 'var(--mist)' : 'var(--sand)',
        background: 'var(--indigo)', padding: '5px 10px', borderRadius: '999px',
      }}
    >
      <DragHandle />
      <span style={{ textDecoration: l.isRetired ? 'line-through' : 'none' }}>
        {l.nameAr} · {l.defaultTimeLimitS}ث
      </span>
      <button onClick={() => setEditing(true)} title="تحرير التصنيف" style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>تحرير</button>
      {l.isRetired ? (
        <button onClick={restore} title="إعادة تفعيل التصنيف" style={{ border: 'none', background: 'transparent', color: 'var(--teal)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>تفعيل</button>
      ) : (
        <button onClick={retire} title="إيقاف التصنيف" style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>إيقاف</button>
      )}
      <DeleteControl
        what="التصنيف"
        childCount={0}
        childNoun="سؤال"
        onDelete={async () => { await api.deleteLabel(l.id); await onReload(); }}
      />
    </span>
  );
}

function AreaBlock({ area, index, areas, persistAreasOrder, testId, onReload }) {
  const [editing, setEditing] = useState(false);
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
      {editing ? (
        <InlineEdit
          nameAr={area.nameAr}
          nameEn={area.nameEn}
          onSave={async ({ nameAr, nameEn }) => {
            await api.updateArea(area.id, { nameAr, nameEn });
            setEditing(false);
            await onReload();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...label13, display: 'flex', alignItems: 'center', gap: '6px' }}><DragHandle />{area.nameAr}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {area.appliesToTracks?.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--lime)' }}>{area.appliesToTracks.join(', ')}</span>
            )}
            <button onClick={() => setEditing(true)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '12px' }}>تحرير</button>
            <DeleteControl
              what="المجال"
              childCount={area.labels.length}
              childNoun="تصنيف"
              onDelete={async () => { await api.deleteArea(area.id); await onReload(); }}
            />
          </span>
        </div>
      )}
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
  const [editing, setEditing] = useState(false);
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
      {editing ? (
        <div style={{ marginBottom: '10px' }}>
          <InlineEdit
            nameAr={section.nameAr}
            nameEn={section.nameEn}
            extra={{ label: 'الوزن', value: section.weight }}
            onSave={async ({ nameAr, nameEn, extra }) => {
              const weight = Number(extra);
              await api.updateSection(section.id, {
                nameAr,
                nameEn,
                // Weight drives how heavily the selection engine draws from
                // this section — never let a blank field silently zero it.
                ...(Number.isFinite(weight) && weight > 0 ? { weight } : {}),
              });
              setEditing(false);
              await onReload();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
          <span style={{ ...label13, fontWeight: 500, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DragHandle />{section.nameAr} <span style={{ color: 'var(--mist)', fontSize: '11px' }}>· وزن {section.weight}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setEditing(true)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: '12px' }}>تحرير</button>
            <DeleteControl
              what="القسم"
              childCount={section.areas.length}
              childNoun="مجال"
              onDelete={async () => { await api.deleteSection(section.id); await onReload(); }}
            />
          </span>
        </div>
      )}
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
  const [exporting, setExporting] = useState(false);

  // ADM-093 — the whole tree, every test, not just the one on screen: the
  // point of the sheet is to see and compare all of it at once, and to look
  // up the label ids the bulk importer needs.
  const exportAll = async () => {
    setExporting(true);
    try {
      const rows = await api.exportTaxonomy();
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(`wathb-taxonomy-${today}.csv`, rows);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!testId && tests.length) setTestId(tests[0].id);
  }, [tests, testId]);

  const reload = async () => {
    if (testId) setTree(await api.tree(testId));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [testId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الاختبارات والتصنيف</h1>
        <Button variant="secondary" disabled={exporting} onClick={exportAll}>
          {exporting ? 'جاري التصدير…' : 'تصدير الشجرة (CSV)'}
        </Button>
      </div>

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
            {t.isActive === false && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--coral)' }}>معطّل</span>}
          </button>
        ))}
        {testId && (() => {
          const current = tests.find((t) => t.id === testId);
          if (!current) return null;
          return (
            <button
              onClick={async () => { await api.updateTest(testId, { isActive: !current.isActive }); await onTestsChanged(); }}
              style={{ border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: current.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
              title="اختبار معطّل لا يظهر للطلاب في اختيار الهدف؛ الطلاب المرتبطون به حالياً لا يتأثرون."
            >
              {current.isActive ? 'تعطيل الاختبار' : 'تفعيل الاختبار'}
            </button>
          );
        })()}
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
