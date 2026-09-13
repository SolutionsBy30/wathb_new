import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };

/**
 * ADM-064 — pick a school by searching its name, across the whole registry.
 *
 * Distinct from SchoolPicker, which narrows region → city → school and is what
 * the student and the student-detail screens want: there, the person knows the
 * city and is choosing within it. Here the admin knows a name and not much
 * else — that is the situation a duplicate school creates — so the search runs
 * server-side over every school rather than inside one city.
 *
 * Every option carries its city, region and student count. Those are not
 * decoration: two schools being merged usually have nearly the same name,
 * which is why they are being merged, and the city and headcount are what
 * tell them apart.
 */
export default function SchoolSearchPicker({ value, onChange, placeholder, exclude, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  // Clearing the value from outside (after a successful merge) must clear the
  // label too, or the picker keeps showing a school that no longer exists.
  useEffect(() => { if (!value) { setSelected(null); setQuery(''); } }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      api.adminListSchools({ search: query })
        .then((rows) => { if (!cancelled) { setOptions(rows); setHighlight(0); } })
        .catch(() => { if (!cancelled) setOptions([]); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, query ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

  // Clicking anywhere else closes the list; without this it stays open behind
  // whatever the admin clicks next.
  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const visible = options.filter((o) => o.id !== exclude);

  const pick = (school) => {
    setSelected(school);
    setQuery('');
    setOpen(false);
    onChange(school.id, school);
  };

  if (selected) {
    return (
      <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.nameAr}
          </span>
          <span style={label}>{selected.cityNameAr}، {selected.regionNameAr} · {selected.students} طالب</span>
        </span>
        <button
          onClick={() => { setSelected(null); setQuery(''); onChange('', null); }}
          disabled={disabled}
          style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px', flexShrink: 0 }}
        >
          تغيير
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        style={fieldStyle}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, visible.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && visible[highlight]) { e.preventDefault(); pick(visible[highlight]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 'calc(100% + 4px)', zIndex: 20,
            background: 'var(--indigo)', border: '0.5px solid var(--on-indigo-line)', borderRadius: 'var(--radius-sm)',
            maxHeight: '260px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {busy && <div style={{ padding: '10px 12px', ...label }}>جارٍ البحث…</div>}
          {!busy && visible.length === 0 && <div style={{ padding: '10px 12px', ...label }}>لا مدرسة مطابقة.</div>}
          {visible.map((o, i) => (
            <div
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '9px 12px', cursor: 'pointer',
                background: i === highlight ? 'var(--on-indigo-subtle)' : 'transparent',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--on-indigo-line)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{o.nameAr}</div>
              <div style={label}>{o.cityNameAr}، {o.regionNameAr} · {o.students} طالب · {o.admins} مسؤول</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
