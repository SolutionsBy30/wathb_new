import { useEffect, useState } from 'react';

/**
 * STU-035 — region → city → school, plus a way out when the school is missing.
 *
 * The city is not stored on the student: a school belongs to a city, so
 * choosing the school sets both. Region and city are here purely to narrow the
 * school list to something a person can read — a flat list of every school in
 * the country is not a picker.
 *
 * `api` is passed in rather than imported so the same component serves the
 * student app and the admin console, which have separate clients with
 * different auth. Only the endpoints below are used, and both apps expose them
 * under the same names.
 *
 * In the console allowSuggest stays off: creating a school needs the
 * 'geography' permission, which an admin working the students screen may not
 * hold, and a button that 403s is worse than no button. Missing schools are
 * added on the geography screen.
 */
export function SchoolPicker({ api, value, onPick, onSuggest, allowSuggest = false, labelStyle, fieldStyle }) {
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [schools, setSchools] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [suggestName, setSuggestName] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.listRegions().then(setRegions).catch(() => {}); }, [api]);

  // Seed the two upper levels from the school already on file, so opening the
  // picker shows where the student currently is rather than an empty form
  // that looks like nothing was ever set.
  useEffect(() => {
    if (!value?.city) return;
    setRegionId(value.city.region?.id ?? '');
    setCityId(value.city.id ?? '');
  }, [value?.city?.id, value?.city?.region?.id]);

  useEffect(() => {
    if (!regionId) { setCities([]); return; }
    api.listCities(regionId).then(setCities).catch(() => {});
  }, [api, regionId]);

  useEffect(() => {
    if (!cityId) { setSchools([]); return; }
    api.listSchools(cityId).then(setSchools).catch(() => {});
  }, [api, cityId]);

  const submitSuggestion = async () => {
    const name = suggestName.trim();
    if (!name || !cityId) return;
    setSuggesting(true);
    setError(null);
    setNote(null);
    try {
      const created = await onSuggest(cityId, name);
      setSuggestName('');
      // Selectable immediately even though it is pending review — otherwise
      // adding a missing school is a dead end: you add it and still cannot
      // choose it.
      setSchools((prev) => [...prev, created]);
      await onPick(created.id);
      setNote('أُضيفت المدرسة وسيراجعها الفريق. تم اختيارها لك.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const select = { ...fieldStyle };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select
          value={regionId}
          onChange={(e) => { setRegionId(e.target.value); setCityId(''); setNote(null); }}
          style={select}
        >
          <option value="">المنطقة</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
        </select>

        <select
          value={cityId}
          onChange={(e) => { setCityId(e.target.value); setNote(null); }}
          disabled={!regionId}
          style={select}
        >
          <option value="">المدينة</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>

        <select
          value={value?.schoolId ?? ''}
          onChange={(e) => { setNote(null); onPick(e.target.value || null); }}
          disabled={!cityId}
          style={select}
        >
          <option value="">المدرسة</option>
          {schools.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.nameAr}{sc.status !== 'approved' ? ' (قيد المراجعة)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* §4.8 — the school is optional and skippable, so removing it has to be
          as easy as setting it. */}
      {value?.schoolId && (
        <button
          onClick={() => onPick(null)}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}
        >
          إزالة المدرسة
        </button>
      )}

      {allowSuggest && cityId && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={suggestName}
            onChange={(e) => setSuggestName(e.target.value)}
            placeholder="مدرستك غير موجودة؟ اكتب اسمها"
            style={{ ...fieldStyle, minWidth: '200px' }}
          />
          <button
            onClick={submitSuggestion}
            disabled={suggesting || !suggestName.trim()}
            style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          >
            {suggesting ? 'جاري الإضافة…' : 'إضافة'}
          </button>
        </div>
      )}

      {note && <span style={{ ...labelStyle, color: 'var(--teal)' }}>{note}</span>}
      {error && <span style={{ ...labelStyle, color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}
