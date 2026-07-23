import { useEffect, useState } from 'react';
import { api } from '../api/client';

function KpiCard({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px', flex: 1 }}>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: 'var(--sand)' }}>{value}</span>
      {sub && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>{sub}</span>}
    </div>
  );
}

function AlertSection({ title, count, children }) {
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{title}</h3>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: count > 0 ? 'var(--coral)' : 'var(--teal-ink)' }}>{count}</span>
      </div>
      {count === 0 ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا شيء يستدعي الانتباه.</p>
      ) : children}
    </div>
  );
}

// ADM-001/002 — the admin console's landing screen: headline KPIs and an
// alerts feed covering content-exhaustion risk, question-quality flags, and
// magic-link sharing anomalies (NFR-007).
export default function Overview() {
  const [kpis, setKpis] = useState(null);
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    api.overviewKpis().then(setKpis);
    api.overviewAlerts().then(setAlerts);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>نظرة عامة</h1>

      {kpis && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <KpiCard label="الاشتراكات النشطة" value={kpis.activeSubscriptions} />
          <KpiCard label="الإيراد الشهري المتكرر" value={`${kpis.mrrSar.toLocaleString('en-US')} ﷼`} />
          <KpiCard
            label="معدل إكمال الوثبات (٣٠ يوماً)"
            value={kpis.wathbCompletionRate == null ? '—' : `${Math.round(kpis.wathbCompletionRate * 100)}%`}
            sub={`من ${kpis.wathbCompletionSampleSize} وثبة`}
          />
          <KpiCard label="مؤشر صحة بنك الأسئلة" value={kpis.bankHealthScore == null ? '—' : `${kpis.bankHealthScore}%`} />
        </div>
      )}

      {alerts && (
        <div className="sd-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <AlertSection title="تصنيفات تقترب من نفاد المحتوى" count={alerts.thinLabels.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alerts.thinLabels.slice(0, 8).map((l) => (
                <div key={l.labelId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--sand)' }}>{l.nameAr}</span>
                  <span style={{ fontFamily: 'var(--font-latin)', color: 'var(--coral)' }}>{l.published}/{l.floor}</span>
                </div>
              ))}
              {alerts.thinLabels.length > 8 && <span style={{ fontSize: '11px', color: 'var(--mist)' }}>+{alerts.thinLabels.length - 8} أخرى</span>}
            </div>
          </AlertSection>

          <AlertSection title="أسئلة بمؤشر تمييز سالب — تحقق من مفتاح الإجابة" count={alerts.negativeDiscrimination.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alerts.negativeDiscrimination.slice(0, 8).map((q) => (
                <div key={q.questionId} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{q.stem}</span>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--coral)' }}>{q.labelNameAr} · {q.discrimination.toFixed(2)}</span>
                </div>
              ))}
              {alerts.negativeDiscrimination.length > 8 && <span style={{ fontSize: '11px', color: 'var(--mist)' }}>+{alerts.negativeDiscrimination.length - 8} أخرى</span>}
            </div>
          </AlertSection>

          <AlertSection title="أسئلة غير مميّزة (نسبة إجابة صحيحة متطرفة)" count={alerts.nonDiscriminating.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alerts.nonDiscriminating.slice(0, 8).map((q) => (
                <div key={q.questionId} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{q.stem}</span>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--coral)' }}>{q.labelNameAr} · {Math.round(q.pValue * 100)}%</span>
                </div>
              ))}
              {alerts.nonDiscriminating.length > 8 && <span style={{ fontSize: '11px', color: 'var(--mist)' }}>+{alerts.nonDiscriminating.length - 8} أخرى</span>}
            </div>
          </AlertSection>

          <AlertSection title="روابط سحرية بأنماط مشاركة مريبة" count={alerts.sharingAnomalies.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alerts.sharingAnomalies.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--sand)' }}>{a.purpose} · {a.subjectType}</span>
                  <span style={{ fontFamily: 'var(--font-latin)', color: 'var(--coral)' }}>{a.distinctIps} عناوين IP</span>
                </div>
              ))}
            </div>
          </AlertSection>
        </div>
      )}
    </div>
  );
}
