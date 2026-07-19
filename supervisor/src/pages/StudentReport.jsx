import { Bar } from '../design-system/components/Bar';

const lineStyle = { borderBottom: '0.5px solid var(--on-indigo-line)' };

function heatmapWeeks(heatmap, weeks = 8) {
  const byDay = new Map(heatmap.map((h) => [h.day, h.count]));
  const today = new Date();
  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(today);
      dt.setUTCDate(dt.getUTCDate() - (w * 7 + d));
      days.push((byDay.get(dt.toISOString().slice(0, 10)) ?? 0) > 0);
    }
    cells.push(days);
  }
  return cells;
}

export default function StudentReport({ report, onBack }) {
  if (!report) return <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للوحة</button>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{report.student.name}</h1>
      </div>

      <div style={{ display: 'flex', gap: '32px' }}>
        <Stat label="الإجمالي (مدى الحياة)" value={report.totals.lifetimeAnswered} />
        <Stat label="هذا الأسبوع" value={report.totals.weekAnswered} />
        <Stat label="سلسلة الوثبات" value={report.streak.current} color="var(--lime)" />
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الدقة حسب المجال</h2>
        {report.accuracyByArea.length === 0 && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد بيانات بعد.</p>}
        {report.accuracyByArea.map((area) => (
          <div key={area.areaId} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--sand)' }}>{area.nameAr}</span>
              <span style={{ fontFamily: 'var(--font-latin)', color: area.collecting ? 'var(--mist)' : 'var(--teal-ink)' }}>
                {area.collecting ? `قيد الجمع — ${area.nAnswered} من ${area.needed}` : `${Math.round(area.accuracy * 100)}%`}
              </span>
            </div>
            <Bar value={area.collecting ? 0 : Math.round(area.accuracy * 100)} tone={!area.collecting && area.accuracy < 0.6 ? 'coral' : 'teal'} style={{ height: '7px' }} />
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاتساق</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {heatmapWeeks(report.heatmap).map((week, wi) => (
            <div key={wi} style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
              {week.map((filled, di) => (
                <div key={di} style={{ width: '13px', height: '13px', borderRadius: '3px', background: filled ? 'var(--lime)' : 'var(--indigo)' }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>أخطاء حديثة</h2>
        {report.recentMistakes.length === 0 && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد أخطاء حديثة.</p>}
        {report.recentMistakes.map((m, i) => {
          const correctText = (m.options || []).find((o) => o.key === m.correctKey)?.text ?? m.correctKey;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px', ...lineStyle }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>{m.stem}</p>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', fontWeight: 500, color: 'var(--coral)' }}>الصحيح: {correctText}</p>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>{m.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'var(--sand)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color }}>{value}</span>
    </div>
  );
}
