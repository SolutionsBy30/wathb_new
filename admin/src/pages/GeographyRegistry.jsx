import { useEffect, useState } from 'react';
import { api } from '../api/client';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0', borderTop: '0.5px solid var(--on-indigo-line)' };
const btnStyle = { border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px' };

function RenameField({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <input style={{ ...fieldStyle, width: '160px' }} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button
        disabled={busy || draft === value || !draft.trim()}
        onClick={async () => { setBusy(true); try { await onSave(draft.trim()); } finally { setBusy(false); } }}
        style={{ ...btnStyle, background: 'var(--lime)', color: 'var(--lime-ink)' }}
      >
        حفظ
      </button>
    </div>
  );
}

// ADM-063/064 — direct registry management: rename/deactivate regions and
// cities, city aliases (variant spellings resolving to one canonical
// city), and a school-merge tool that repoints enrollments rather than
// orphaning them.
export default function GeographyRegistry() {
  const [regions, setRegions] = useState([]);
  const [citiesByRegion, setCitiesByRegion] = useState({});
  const [openRegion, setOpenRegion] = useState(null);
  const [newAlias, setNewAlias] = useState({});
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeResult, setMergeResult] = useState(null);
  const [mergeError, setMergeError] = useState(null);

  const load = () => api.adminListRegions().then(setRegions);
  useEffect(() => { load(); }, []);

  const loadCities = async (regionId) => {
    const cities = await api.adminListCities(regionId);
    setCitiesByRegion((prev) => ({ ...prev, [regionId]: cities }));
  };

  const toggleRegion = async (id) => {
    if (openRegion === id) return setOpenRegion(null);
    setOpenRegion(id);
    if (!citiesByRegion[id]) await loadCities(id);
  };

  const doMerge = async () => {
    setMergeError(null);
    setMergeResult(null);
    if (!mergeSource.trim() || !mergeTarget.trim()) return;
    try {
      setMergeResult(await api.mergeSchools(mergeSource.trim(), mergeTarget.trim()));
      setMergeSource('');
      setMergeTarget('');
    } catch (e) {
      setMergeError(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>إدارة السجل الجغرافي</h2>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        {regions.map((r) => (
          <div key={r.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={rowStyle}>
              <button onClick={() => toggleRegion(r.id)} style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: r.isActive ? 'var(--sand)' : 'var(--mist)', textDecoration: r.isActive ? 'none' : 'line-through' }}>
                {r.nameAr}
              </button>
              <RenameField value={r.nameAr} onSave={async (v) => { await api.updateRegion(r.id, { nameAr: v }); load(); }} />
              <button
                onClick={async () => { await api.setRegionActive(r.id, !r.isActive); load(); }}
                style={{ ...btnStyle, marginInlineStart: 'auto', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: r.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
              >
                {r.isActive ? 'تعطيل' : 'تفعيل'}
              </button>
            </div>

            {openRegion === r.id && (
              <div style={{ marginInlineStart: '20px', display: 'flex', flexDirection: 'column' }}>
                {(citiesByRegion[r.id] ?? []).map((c) => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', ...rowStyle }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: c.isActive ? 'var(--mist)' : 'var(--coral)', textDecoration: c.isActive ? 'none' : 'line-through' }}>
                        {c.nameAr}
                      </span>
                      <RenameField value={c.nameAr} onSave={async (v) => { await api.updateCity(c.id, { nameAr: v }); loadCities(r.id); }} />
                      <button
                        onClick={async () => { await api.setCityActive(c.id, !c.isActive); loadCities(r.id); }}
                        style={{ ...btnStyle, marginInlineStart: 'auto', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: c.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
                      >
                        {c.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingInlineStart: '8px' }}>
                      {(c.aliases ?? []).map((a) => (
                        <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--sand)', background: 'var(--indigo)', borderRadius: '999px', padding: '3px 8px' }}>
                          {a.alias}
                          <button onClick={async () => { await api.removeCityAlias(a.id); loadCities(r.id); }} style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>×</button>
                        </span>
                      ))}
                      <input
                        value={newAlias[c.id] ?? ''}
                        onChange={(e) => setNewAlias((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="إضافة اسم بديل…"
                        style={{ ...fieldStyle, width: '120px', padding: '5px 8px', fontSize: '11px' }}
                      />
                      <button
                        onClick={async () => {
                          const alias = (newAlias[c.id] ?? '').trim();
                          if (!alias) return;
                          await api.addCityAlias(c.id, alias);
                          setNewAlias((prev) => ({ ...prev, [c.id]: '' }));
                          loadCities(r.id);
                        }}
                        style={{ ...btnStyle, background: 'var(--lime)', color: 'var(--lime-ink)' }}
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '480px' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>دمج مدرستين مكررتين</h3>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          يُعاد توجيه جميع طلاب المدرسة المصدر إلى المدرسة الهدف، ثم تُحذف المدرسة المصدر. الصق معرّف كل مدرسة (id).
        </p>
        <input value={mergeSource} onChange={(e) => setMergeSource(e.target.value)} placeholder="معرّف المدرسة المصدر (تُحذف)" style={fieldStyle} />
        <input value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} placeholder="معرّف المدرسة الهدف (تبقى)" style={fieldStyle} />
        {mergeError && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{mergeError}</p>}
        {mergeResult && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--teal-ink)' }}>تم نقل {mergeResult.mergedStudents} طالباً إلى المدرسة الهدف.</p>}
        <button onClick={doMerge} disabled={!mergeSource.trim() || !mergeTarget.trim()} style={{ ...btnStyle, alignSelf: 'flex-start', background: 'var(--coral)', color: 'var(--indigo)' }}>
          دمج
        </button>
      </div>
    </div>
  );
}
