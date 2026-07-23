import { Bar } from '../../../design-system/components/Bar';
import { Button } from '../../../design-system/components/Button';

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

// FRE-004 — a locked placeholder for a diagnostic section the free tier
// doesn't unlock. The server never sent real numbers for this section, so
// there is nothing to blur — this is a lock + upgrade prompt, not CSS blur
// over real data (NFR-006a).
function LockedSection({ title, onUpgrade }) {
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{title}</h2>
      <span style={{ fontSize: '22px' }}>🔒</span>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
        متاح في الباقات المدفوعة
      </p>
      <Button variant="primary" onClick={onUpgrade} style={{ padding: '8px 20px', fontSize: '12px' }}>ترقية الباقة</Button>
    </div>
  );
}

export default function Performance({ report, onUpgrade }) {
  if (!report) {
    return <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري تحميل الأداء…</p>;
  }

  if (report.restricted) {
    return (
      <>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي</h1>

        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mist)' }}>الإجمالي (مدى الحياة)</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{report.totals.lifetimeAnswered}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mist)' }}>هذا الأسبوع</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{report.totals.weekAnswered}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--lime)' }}>{report.streak.current}</span>
          </div>
        </div>

        <LockedSection title="الدقة حسب المجال" onUpgrade={onUpgrade} />
        <LockedSection title="المؤشر المركّب — اتجاه أسبوعي" onUpgrade={onUpgrade} />
        <LockedSection title="الاتساق والسرعة مقابل الهدف" onUpgrade={onUpgrade} />
        <LockedSection title="أخطاء حديثة" onUpgrade={onUpgrade} />
      </>
    );
  }

  const trend = report.trend.filter((t) => t.accuracy !== null);
  const maxAcc = Math.max(...trend.map((t) => t.accuracy), 0.01);
  const allLabels = report.accuracyByArea.flatMap((a) => a.labels ?? []);

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي</h1>

      <div style={{ display: 'flex', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>الإجمالي (مدى الحياة)</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{report.totals.lifetimeAnswered}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>هذا الأسبوع</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{report.totals.weekAnswered}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--lime)' }}>{report.streak.current}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>المؤشر المركّب</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>
              {report.compositeIndex === null ? '—' : report.compositeIndex}
            </span>
            {report.compositeIndexDelta !== null && report.compositeIndexDelta !== 0 && (
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: report.compositeIndexDelta > 0 ? 'var(--teal-ink)' : 'var(--coral)' }}>
                {report.compositeIndexDelta > 0 ? '↑' : '↓'} {Math.abs(Math.round(report.compositeIndexDelta * 100))}
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الدقة حسب المجال</h2>
        {report.accuracyByArea.length === 0 && (
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد بيانات بعد — أكمل وثبتك الأولى.</p>
        )}
        {report.accuracyByArea.map((area) => (
          <div key={area.areaId} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--sand)', fontWeight: 500 }}>{area.nameAr}</span>
                <span style={{ fontFamily: 'var(--font-latin)', color: area.collecting ? 'var(--mist)' : 'var(--teal-ink)' }}>
                  {area.collecting ? `قيد الجمع — ${area.nAnswered} من ${area.needed}` : `${Math.round(area.accuracy * 100)}%`}
                </span>
              </div>
              <Bar value={area.collecting ? 0 : Math.round(area.accuracy * 100)} tone={!area.collecting && area.accuracy < 0.6 ? 'coral' : 'teal'} style={{ height: '7px' }} />
            </div>
            {area.labels?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingInlineStart: '8px' }}>
                {area.labels.map((l) => (
                  <div key={l.labelId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--mist)' }}>{l.nameAr}</span>
                    <span style={{ fontFamily: 'var(--font-latin)', color: l.collecting ? 'var(--mist)' : l.accuracy < 0.6 ? 'var(--coral)' : 'var(--sand)' }}>
                      {l.collecting ? `${l.nAnswered}/${l.needed}` : `${Math.round(l.accuracy * 100)}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sd-card-grid" style={{ gap: '20px' }}>
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>المؤشر المركّب — اتجاه أسبوعي</h2>
          {trend.length === 0 ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد بيانات كافية بعد.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
              {trend.map((t, i) => (
                <div
                  key={t.weekStart}
                  style={{
                    flex: 1,
                    height: `${12 + Math.round((t.accuracy / maxAcc) * 60)}px`,
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    background: i === trend.length - 1 ? 'var(--lime)' : 'var(--on-indigo-line)',
                  }}
                  title={`${t.weekStart}: ${Math.round(t.accuracy * 100)}%`}
                />
              ))}
            </div>
          )}
        </div>
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاتساق</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {heatmapWeeks(report.heatmap).map((week, wi) => (
              <div key={wi} style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                {week.map((filled, di) => (
                  <div key={di} style={{ width: '13px', height: '13px', borderRadius: '3px', background: filled ? 'var(--lime)' : 'var(--on-indigo-subtle)' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>السرعة مقابل الهدف</h2>
        {allLabels.length === 0 && (
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد بيانات بعد.</p>
        )}
        {allLabels.map((l) => {
          const hasTiming = l.meanTimeS != null && l.targetTimeS != null;
          const diff = hasTiming ? l.meanTimeS - l.targetTimeS : null;
          const speedText = !hasTiming ? '—' : diff <= 0 ? `أسرع من الهدف بـ${Math.abs(diff)}ث` : `أبطأ من الهدف بـ${diff}ث`;
          const speedColor = !hasTiming ? 'var(--mist)' : diff <= 0 ? 'var(--teal-ink)' : 'var(--coral)';
          return (
            <div key={l.labelId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
              <span style={{ color: 'var(--sand)' }}>{l.nameAr}</span>
              <span style={{ fontFamily: 'var(--font-latin)', color: speedColor }}>{speedText}</span>
            </div>
          );
        })}
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>أخطاء حديثة</h2>
        {report.recentMistakes.length === 0 && (
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد أخطاء حديثة — استمر!</p>
        )}
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
    </>
  );
}
