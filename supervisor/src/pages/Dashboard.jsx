import { Bar } from '../design-system/components/Bar';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return days >= 0 ? days : null;
}

function StudentCard({ s, onOpen, onPay }) {
  const countdown = daysUntil(s.testDate);
  return (
    <div
      style={{
        boxSizing: 'border-box', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)',
        padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '260px', width: '320px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{s.name}</span>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>🔥 {s.streak}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>المؤشر المركّب</span>
        {s.compositeIndex == null ? (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>قيد الجمع</span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{s.compositeIndex}</span>
            {s.compositeIndexDelta != null && s.compositeIndexDelta !== 0 && (
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: s.compositeIndexDelta > 0 ? 'var(--teal-ink)' : 'var(--coral)' }}>
                {s.compositeIndexDelta > 0 ? '↑' : '↓'} {Math.abs(Math.round(s.compositeIndexDelta * 100))}
              </span>
            )}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '18px', background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>إجمالي الأسئلة</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{s.totalAnswered ?? 0}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>صحيحة</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--teal-ink)' }}>{s.totalCorrect ?? 0}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>خاطئة</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--coral)' }}>{s.totalWrong ?? 0}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--mist)' }}>
          <span>{s.weekAnswered} من {s.weeklyTarget ?? 35} هذا الأسبوع</span>
          <span>{Math.round((s.weekAnswered / (s.weeklyTarget ?? 35)) * 100)}%</span>
        </div>
        <Bar value={Math.round((s.weekAnswered / (s.weeklyTarget ?? 35)) * 100)} tone="teal" style={{ height: '6px' }} />
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
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onOpen(s.studentId)}
          style={{
            flex: 1, minHeight: '40px', borderRadius: '999px', border: 'none', cursor: 'pointer',
            background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)',
            fontFamily: 'var(--font-arabic)', fontSize: '13px', fontWeight: 500,
          }}
        >
          عرض التقرير
        </button>
        <button
          onClick={() => onPay(s.studentId, s.name)}
          style={{
            flex: 1, minHeight: '40px', borderRadius: '999px', border: 'none', cursor: 'pointer',
            background: 'var(--lime)', color: 'var(--lime-ink)',
            fontFamily: 'var(--font-arabic)', fontSize: '13px', fontWeight: 500,
          }}
        >
          الدفع نيابة عنه
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ data, onOpenStudent, onPayForStudent }) {
  if (!data) return null;

  if (data.viewMode === 'family_card') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي</h1>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {data.students.map((s) => <StudentCard key={s.studentId} s={s} onOpen={onOpenStudent} onPay={onPayForStudent} />)}
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
              <th style={th}>المؤشر المركّب</th>
              <th style={th}>أضعف مجال</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.studentId} onClick={() => onOpenStudent(s.studentId)} style={{ cursor: 'pointer', borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{s.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>{s.streak}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }}>{s.weekAnswered}</span></td>
                <td style={td}>
                  {s.compositeIndex == null ? (
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>قيد الجمع</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }}>
                      {s.compositeIndex}
                      {s.compositeIndexDelta != null && s.compositeIndexDelta !== 0 && (
                        <span style={{ color: s.compositeIndexDelta > 0 ? 'var(--teal-ink)' : 'var(--coral)' }}>
                          {' '}{s.compositeIndexDelta > 0 ? '↑' : '↓'}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td style={td}>
                  {s.topWeakness ? (
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{s.topWeakness.nameAr} ({Math.round(s.topWeakness.accuracy * 100)}%)</span>
                  ) : <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>قيد الجمع</span>}
                </td>
                <td style={td} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onPayForStudent(s.studentId, s.name)}
                    style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}
                  >
                    الدفع نيابة عنه
                  </button>
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
