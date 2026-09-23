import { useEffect, useState } from 'react';
import { api } from '../api/client';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const btn = { border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px' };

const SECTION_LABELS = {
  hero: 'الواجهة العلوية',
  features: 'قسم المميزات',
  groups: 'مقدمة قسم الاختبارات',
  pricing: 'الشريط الختامي',
  footer: 'التذييل',
};
const SECTION_ORDER = ['hero', 'features', 'groups', 'pricing', 'footer'];

/**
 * CMS-001 — the landing page's copy.
 *
 * One field per key, saved on its own. A single "save everything" button would
 * make one typo block four corrections, and these edits arrive one at a time:
 * someone fixes a headline, not the page.
 *
 * What is deliberately NOT here: test-group names and descriptions (edited on
 * «الاختبارات والتصنيف», where the groups themselves live) and package names,
 * prices and features (edited on «الباقات»). Those already render on the
 * landing page straight from their own records; duplicating them into a second
 * editor would give the same string two owners.
 */
export default function LandingContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setData(await api.landingContent());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  if (error) return <p style={{ ...label, color: 'var(--coral)' }}>{error}</p>;
  if (!data) return <p style={label}>جارٍ التحميل…</p>;

  const sections = SECTION_ORDER.filter((s) => data.keys.some((k) => k.section === s));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>الصفحة الرئيسية</h2>
        <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
          نصوص الصفحة العامة. التعديل يظهر للزوار مباشرة بلا إصدار جديد.
          أسماء مجموعات الاختبارات ووصفها تُحرَّر من «الاختبارات والتصنيف»، وأسعار الباقات ومميزاتها من «الباقات» — وتظهر في الصفحة تلقائياً.
        </p>
      </div>

      {sections.map((s) => (
        <div key={s} style={card}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{SECTION_LABELS[s] ?? s}</span>
          {data.keys.filter((k) => k.section === s).map((k) => (
            <TextField key={k.key} def={k} onSaved={load} />
          ))}
        </div>
      ))}

      <Features features={data.features} onChanged={load} />
    </div>
  );
}

function TextField({ def, onSaved }) {
  const [value, setValue] = useState(def.valueAr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The row is re-fetched after every save, so a remount must not strand the
  // field on a stale value.
  useEffect(() => { setValue(def.valueAr); }, [def.valueAr]);

  const dirty = value !== def.valueAr;

  const save = async () => {
    setSaving(true);
    try {
      await api.setLandingText(def.key, value);
      setError(null);
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={label}>{def.labelAr}</span>
        {def.isDefault && <span style={{ ...label, color: 'var(--mist)', opacity: 0.8 }}>· النص الافتراضي</span>}
      </div>
      {def.hintAr && <span style={{ ...label, opacity: 0.75, lineHeight: 1.8 }}>{def.hintAr}</span>}
      {def.multiline ? (
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={2000} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.8 }} />
      ) : (
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} style={fieldStyle} />
      )}
      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
      {dirty && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={save} disabled={saving} style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)' }}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button onClick={() => { setValue(def.valueAr); setError(null); }} style={{ ...btn, background: 'transparent', color: 'var(--mist)' }}>
            تراجع
          </button>
        </div>
      )}
    </div>
  );
}

/** The feature cards under «مصمم لثلاث جهات» — added, reordered and retired. */
function Features({ features, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const remove = async (f) => {
    if (!window.confirm(`حذف ميزة «${f.titleAr}»؟`)) return;
    try {
      await api.deleteLandingFeature(f.id);
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = async (f) => {
    try {
      await api.updateLandingFeature(f.id, { isActive: !f.isActive });
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const active = features.filter((f) => f.isActive).length;

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>بطاقات المميزات</span>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
            + بطاقة جديدة
          </button>
        )}
      </div>
      <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
        تظهر في شبكة تحت عنوان قسم المميزات، مرتّبة حسب رقم الترتيب. البطاقة المعطّلة تبقى محفوظة ولا تظهر للزوار.
        {active === 0 && <span style={{ color: '#E8C547' }}> لا توجد بطاقة مفعّلة — القسم سيظهر فارغاً.</span>}
      </p>

      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}

      {adding && (
        <FeatureForm
          onCancel={() => setAdding(false)}
          onSave={async (dto) => { await api.createLandingFeature(dto); setAdding(false); await onChanged(); }}
        />
      )}

      {features.map((f) => (
        editing === f.id ? (
          <FeatureForm
            key={f.id}
            initial={f}
            onCancel={() => setEditing(null)}
            onSave={async (dto) => { await api.updateLandingFeature(f.id, dto); setEditing(null); await onChanged(); }}
          />
        ) : (
          <div key={f.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '12px', opacity: f.isActive ? 1 : 0.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
                {f.titleAr}
                {!f.isActive && <span style={{ ...label, marginInlineStart: '8px' }}>معطّلة</span>}
              </span>
              <span style={{ ...label, lineHeight: 1.8 }}>{f.bodyAr}</span>
              <span style={{ ...label, opacity: 0.7 }}>ترتيب {f.sort}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setEditing(f.id)} style={{ ...btn, background: 'var(--on-indigo-subtle)', color: 'var(--sand)' }}>تعديل</button>
              <button onClick={() => toggle(f)} style={{ ...btn, background: 'var(--on-indigo-subtle)', color: 'var(--sand)' }}>
                {f.isActive ? 'تعطيل' : 'تفعيل'}
              </button>
              <button onClick={() => remove(f)} style={{ ...btn, background: 'transparent', color: 'var(--coral)' }}>حذف</button>
            </div>
          </div>
        )
      ))}

      {features.length === 0 && !adding && <p style={{ margin: 0, ...label }}>لا بطاقات بعد.</p>}
    </div>
  );
}

function FeatureForm({ initial, onCancel, onSave }) {
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? '');
  const [bodyAr, setBodyAr] = useState(initial?.bodyAr ?? '');
  const [sort, setSort] = useState(initial?.sort ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!titleAr.trim() || !bodyAr.trim()) {
      setError('العنوان والنص مطلوبان.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ titleAr: titleAr.trim(), bodyAr: bodyAr.trim(), sort: Number(sort) || 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>العنوان</span>
        <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} maxLength={120} style={{ ...fieldStyle, background: 'var(--on-indigo-subtle)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>النص</span>
        <textarea value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} rows={3} maxLength={500} style={{ ...fieldStyle, background: 'var(--on-indigo-subtle)', resize: 'vertical', lineHeight: 1.8 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '120px' }}>
        <span style={label}>الترتيب</span>
        <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...fieldStyle, background: 'var(--on-indigo-subtle)' }} />
      </div>
      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={submit} disabled={saving} style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)' }}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        <button onClick={onCancel} style={{ ...btn, background: 'transparent', color: 'var(--mist)' }}>إلغاء</button>
      </div>
    </div>
  );
}
