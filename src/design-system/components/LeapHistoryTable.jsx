const STATUS_LABEL = { pending: 'لم تبدأ', opened: 'قيد التقدم', completed: 'مكتملة', expired: 'منتهية', partial: 'جزئية' };
const STATUS_COLOR = { completed: 'var(--teal-ink)', partial: 'var(--coral)', expired: 'var(--coral)', opened: 'var(--lime)', pending: 'var(--mist)' };
const TYPE_LABEL = { placement: 'تحديد المستوى', standard: 'يومية', passage: 'قطعة' };

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

const th = { textAlign: 'start', padding: '10px 12px', fontWeight: 400 };
const td = { padding: '10px 12px', verticalAlign: 'middle' };

// Shared leap-history table — the student, supervisor and admin apps each
// render this against the same API payload so a leap reads identically
// wherever it's viewed.
export function LeapHistoryTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد وثبات بعد.</p>;
  }
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
        <thead>
          <tr style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
            <th style={th}>التاريخ</th>
            <th style={th}>الاختبار</th>
            <th style={th}>النوع</th>
            <th style={th}>النتيجة</th>
            <th style={th}>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.wathbId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
              <td style={td}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{fmtDate(r.scheduledFor)}</span>
                {r.sequence > 0 && (
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)' }}> · وثبة {r.sequence + 1}</span>
                )}
              </td>
              <td style={td}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{r.testNameAr ?? '—'}</span>
              </td>
              <td style={td}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>{TYPE_LABEL[r.bundleType] ?? r.bundleType}</span>
              </td>
              <td style={td}>
                {r.answered > 0 ? (
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>
                    {r.correct}/{r.answered}
                    <span style={{ color: 'var(--mist)' }}> ({Math.round((r.accuracy ?? 0) * 100)}%)</span>
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>—</span>
                )}
              </td>
              <td style={td}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: STATUS_COLOR[r.status] ?? 'var(--mist)' }}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
