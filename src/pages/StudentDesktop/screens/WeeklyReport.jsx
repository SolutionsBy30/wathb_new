import { Button } from '../../../design-system/components/Button';

function computeDelta(trend) {
  const withData = (trend || []).filter((t) => t.accuracy !== null);
  if (withData.length < 2) return null;
  return withData[withData.length - 1].accuracy - withData[withData.length - 2].accuracy;
}

function pickStrengthWeakness(report) {
  const labels = (report?.accuracyByArea || []).flatMap((a) => a.labels).filter((l) => !l.collecting && l.accuracy !== null);
  if (labels.length === 0) return { strength: null, weakness: null };
  const sorted = [...labels].sort((a, b) => b.accuracy - a.accuracy);
  return { strength: sorted[0], weakness: sorted[sorted.length - 1] };
}

// S11 — the landing target of the weekly WhatsApp link (spec §8.1).
export default function WeeklyReport({ report, onOpenPerformance }) {
  if (!report) return <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const delta = computeDelta(report.trend);
  const { strength, weakness } = pickStrengthWeakness(report);
  const deltaPct = delta === null ? null : Math.round(delta * 100);

  return (
    <>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>تقريرك الأسبوعي</span>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>
        {report.student?.name}
      </h1>

      <div style={{ display: 'flex', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: 'var(--lime)' }}>{report.streak?.current ?? 0}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>هذا الأسبوع</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: 'var(--sand)' }}>{report.totals?.weekAnswered ?? 0}</span>
        </div>
        {deltaPct !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--mist)' }}>التغيّر مقابل الأسبوع الماضي</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: deltaPct >= 0 ? 'var(--teal-ink)' : 'var(--coral)' }}>
              {deltaPct >= 0 ? '+' : ''}{deltaPct}%
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {strength && (
          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', minWidth: '220px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime)' }}>أقوى مجال</span>
            <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>{strength.nameAr}</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--teal-ink)' }}>{Math.round(strength.accuracy * 100)}%</p>
          </div>
        )}
        {weakness && (
          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', minWidth: '220px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>الأضعف — ركّز هنا</span>
            <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>{weakness.nameAr}</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--coral)' }}>{Math.round(weakness.accuracy * 100)}%</p>
          </div>
        )}
      </div>

      {!strength && !weakness && (
        <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد بيانات كافية بعد لتحديد نقاط القوة والضعف.</p>
      )}

      <Button variant="primary" onClick={onOpenPerformance}>عرض التفاصيل الكاملة</Button>
    </>
  );
}
