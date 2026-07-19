function daysUntil(dateStr) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return days >= 0 ? days : null;
}

function StudentCard({ s, onOpen }) {
  const countdown = daysUntil(s.testDate);
  return (
    <button
      onClick={() => onOpen(s.studentId)}
      style={{
        all: 'unset', cursor: 'pointer', boxSizing: 'border-box', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)',
        padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '260px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{s.name}</span>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>🔥 {s.streak}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>
        <span>هذا الأسبوع: {s.weekAnswered} سؤال</span>
      </div>
      {s.topStrength && (
        <span style={{ fontSize: '12px', color: 'var(--teal-ink)', fontFamily: 'var(--font-arabic)' }}>
          أقوى مجال: {s.topStrength.nameAr} ({Math.round(s.topStrength.accuracy * 100)}%)
        </span>
      )}
      {s.topWeakness && (
        <span style={{ fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>
          أضعف مجال: {s.topWeakness.nameAr} ({Math.round(s.topWeakness.accuracy * 100)}%)
        </span>
      )}
      {countdown !== null && (
        <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>الاختبار خلال {countdown} يوماً</span>
      )}
    </button>
  );
}

export default function Dashboard({ data, onOpenStudent }) {
  if (!data) return null;

  if (data.viewMode === 'family_card') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي</h1>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {data.students.map((s) => <StudentCard key={s.studentId} s={s} onOpen={onOpenStudent} />)}
        </div>
        {data.students.length === 0 && <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>لا يوجد طلاب مرتبطون بعد.</p>}
      </div>
    );
  }

  // instructor_table
  const sorted = [...data.students].sort((a, b) => (a.topWeakness?.accuracy ?? 1) - (b.topWeakness?.accuracy ?? 1));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي — {data.students.length} طالباً</h1>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>السلسلة</th>
              <th style={th}>هذا الأسبوع</th>
              <th style={th}>أضعف مجال</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.studentId} onClick={() => onOpenStudent(s.studentId)} style={{ cursor: 'pointer', borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>{s.streak}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }}>{s.weekAnswered}</span></td>
                <td style={td}>
                  {s.topWeakness ? (
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{s.topWeakness.nameAr} ({Math.round(s.topWeakness.accuracy * 100)}%)</span>
                  ) : <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>قيد الجمع</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
