import { useEffect, useState } from 'react';
import { api } from '../api/client';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const btn = { border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px' };

/**
 * ADM-094 — the catalogue's segments.
 *
 * Three or four rows, edited rarely, so this is a plain list rather than the
 * drag-reorder tree the taxonomy below uses. `sort` is a number field for the
 * same reason: with this few rows, typing 1/2/3 is faster than dragging, and
 * it is the only ordering an admin ever needs to express.
 */
export default function TestGroups({ tests, onChanged }) {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      setGroups(await api.listTestGroups());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (g) => {
    if (!window.confirm(`حذف مجموعة «${g.nameAr}»؟`)) return;
    try {
      await api.deleteTestGroup(g.id);
      await load();
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const ungrouped = tests.filter((t) => !t.groupId).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>مجموعات الاختبارات</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            + مجموعة جديدة
          </button>
        )}
      </div>

      <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
        تقسيم الكتالوج إلى قطاعات — اختبارات القياس للثانوية، الشهادات المهنية، اختبارات اللغة الإنجليزية وغيرها.
        التصنيف اختياري؛ الاختبار غير المصنّف يظهر في كل مكان كما كان تحت «غير مصنّف».
        {ungrouped > 0 && <span style={{ color: '#E8C547' }}> يوجد حاليًا {ungrouped} اختبار غير مصنّف.</span>}
      </p>

      {adding && (
        <GroupForm
          onCancel={() => setAdding(false)}
          onSave={async (dto) => { await api.createTestGroup(dto); setAdding(false); await load(); await onChanged(); }}
        />
      )}

      {groups.length === 0 && !adding && (
        <p style={{ margin: 0, ...label }}>لا مجموعات بعد. كل الاختبارات تظهر تحت «غير مصنّف».</p>
      )}

      {groups.map((g) => (
        editing === g.id ? (
          <GroupForm
            key={g.id}
            initial={g}
            onCancel={() => setEditing(null)}
            onSave={async (dto) => { await api.updateTestGroup(g.id, dto); setEditing(null); await load(); await onChanged(); }}
          />
        ) : (
          <div key={g.id} style={{ ...card, opacity: g.isActive ? 1 : 0.55, gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>{g.nameAr}</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{g.nameEn}</span>
              <span style={label}>{g._count?.tests ?? 0} اختبار</span>
              {!g.isActive && <span style={{ ...label, color: 'var(--coral)' }}>معطّلة</span>}
              <span style={{ marginInlineStart: 'auto', display: 'flex', gap: '6px' }}>
                <button onClick={() => setEditing(g.id)} style={{ ...btn, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)' }}>تعديل</button>
                <button
                  onClick={async () => { await api.updateTestGroup(g.id, { isActive: !g.isActive }); await load(); await onChanged(); }}
                  style={{ ...btn, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: g.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
                  title="المجموعة المعطّلة لا تظهر للطلاب؛ اختباراتها تبقى كما هي."
                >
                  {g.isActive ? 'تعطيل' : 'تفعيل'}
                </button>
                <button onClick={() => remove(g)} style={{ ...btn, background: 'transparent', color: 'var(--coral)' }}>حذف</button>
              </span>
            </div>
            {g.descriptionAr && <span style={{ ...label, lineHeight: 1.8 }}>{g.descriptionAr}</span>}
          </div>
        )
      ))}

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}

function GroupForm({ initial, onSave, onCancel }) {
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [descriptionAr, setDescriptionAr] = useState(initial?.descriptionAr ?? '');
  const [sort, setSort] = useState(initial?.sort ?? 0);
  const [busy, setBusy] = useState(false);

  const valid = nameAr.trim() && nameEn.trim();

  return (
    <div style={{ ...card, gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input style={{ ...fieldStyle, minWidth: '200px' }} placeholder="اسم المجموعة (عربي)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        <input style={{ ...fieldStyle, minWidth: '180px', fontFamily: 'var(--font-latin)' }} dir="ltr" placeholder="Group name (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <input style={{ ...fieldStyle, width: '90px', fontFamily: 'var(--font-latin)' }} type="number" placeholder="ترتيب" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
      </div>
      <input style={fieldStyle} placeholder="وصف مختصر (اختياري) — لمن هذه المجموعة" value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          disabled={busy || !valid}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({ nameAr: nameAr.trim(), nameEn: nameEn.trim(), descriptionAr: descriptionAr.trim() || undefined, sort });
            } finally {
              setBusy(false);
            }
          }}
          style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)', opacity: busy || !valid ? 0.5 : 1 }}
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        <button onClick={onCancel} style={{ ...btn, background: 'transparent', color: 'var(--mist)' }}>إلغاء</button>
      </div>
    </div>
  );
}
