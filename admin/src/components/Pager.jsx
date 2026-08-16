/**
 * ADM-089 — shared pager for the admin lists.
 *
 * The API has always returned { total, items } and accepted offset/limit;
 * both screens just asked for the first 100 and rendered them, so anything
 * past 100 was invisible with no indication it existed. That is the whole
 * bug — this is the missing control, not a new capability.
 */
export function Pager({ total, offset, limit, onChange, busy }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const btn = (enabled) => ({
    border: 'none',
    cursor: enabled && !busy ? 'pointer' : 'default',
    padding: '7px 14px',
    borderRadius: '999px',
    fontFamily: 'var(--font-arabic)',
    fontSize: '12px',
    background: 'transparent',
    boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)',
    color: enabled && !busy ? 'var(--sand)' : 'var(--mist)',
    opacity: enabled && !busy ? 1 : 0.45,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 0' }}>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        عرض <span style={{ fontFamily: 'var(--font-latin)' }}>{from}–{to}</span> من{' '}
        <span style={{ fontFamily: 'var(--font-latin)' }}>{total}</span>
        {pages > 1 && <> · صفحة <span style={{ fontFamily: 'var(--font-latin)' }}>{page}/{pages}</span></>}
      </span>

      <div style={{ display: 'flex', gap: '6px', marginInlineStart: 'auto' }}>
        <button disabled={offset === 0 || busy} onClick={() => onChange({ offset: 0, limit })} style={btn(offset > 0)}>الأولى</button>
        <button disabled={offset === 0 || busy} onClick={() => onChange({ offset: Math.max(0, offset - limit), limit })} style={btn(offset > 0)}>السابق</button>
        <button disabled={to >= total || busy} onClick={() => onChange({ offset: offset + limit, limit })} style={btn(to < total)}>التالي</button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
        لكل صفحة
        <select
          value={limit}
          disabled={busy}
          // Reset to the first page: keeping the offset while the page size
          // changes lands the reader somewhere they did not ask to be.
          onChange={(e) => onChange({ offset: 0, limit: Number(e.target.value) })}
          style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '12px' }}
        >
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}
