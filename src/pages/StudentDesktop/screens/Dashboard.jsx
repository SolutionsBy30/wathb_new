import { Bar } from '../../../design-system/components/Bar';

const lineStyle = { borderBottom: '0.5px solid var(--on-indigo-line)' };

export default function Dashboard({ vm, backToDashboardList }) {
  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>لوحتي</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {vm.testPerfRows.map((tp) => (
          <button
            key={tp.id}
            onClick={tp.open}
            style={{ all: 'unset', cursor: 'pointer', background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{tp.name}</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', color: 'var(--sand)' }}>{tp.composite}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--mist)' }}>
                <span>الدقة</span><span>{tp.accuracy}%</span>
              </div>
              <Bar value={tp.accuracy} tone={tp.tone} style={{ height: '7px' }} />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--mist)' }}>
              <span>{tp.totalAnswered} سؤال</span>
              <span>{tp.correct} صحيحة</span>
              <span>{tp.wrong} خاطئة</span>
            </div>
          </button>
        ))}
      </div>

      {vm.showDashboardList && (
        <>
          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime)' }}>معلومة تساعدك في {vm.dailyTip.labelName}</span>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>{vm.dailyTip.text}</p>
          </div>

          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>سجل الوثبات</h2>
            {vm.wathbHistoryRows.map((w) => (
              <button
                key={w.id}
                onClick={w.open}
                style={{ all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', ...lineStyle }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{w.testName}</span>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{w.dateLabel}</span>
                </div>
                <span style={w.accStyle}>{w.scoreText} · {w.accPct}%</span>
              </button>
            ))}
          </div>
        </>
      )}

      {vm.showWathbDetail && vm.wathbDetail && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={backToDashboardList} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للاختبارات</button>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{vm.wathbDetail.testName} · {vm.wathbDetail.dateLabel}</span>
          </div>
          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--mist)' }}>صحيحة</span>
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--teal-ink)' }}>{vm.wathbDetail.correct}/{vm.wathbDetail.total}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--mist)' }}>الدقة</span>
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{vm.wathbDetail.accPct}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--mist)' }}>متوسط الوقت</span>
                <span style={{ ...vm.wathbDetail.speedStyle, fontSize: '22px', fontWeight: 500 }}>{vm.wathbDetail.avgTimeS}ث</span>
              </div>
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>هدف الوقت لهذا الاختبار: {vm.wathbDetail.targetS}ث للسؤال</p>
            <div>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>المجالات المشمولة</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {vm.wathbDetail.labels.map((lbl, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', background: 'var(--on-indigo-subtle)', padding: '6px 12px', borderRadius: '999px' }}>{lbl}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>مراجعة الأسئلة</h3>
            {vm.wathbDetail.questionReviews.map((qr) => (
              <div key={qr.n} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '14px', ...lineStyle }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>سؤال {qr.n}</span>
                <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>{qr.stem}</p>
                <p style={qr.answerLineStyle}>إجابتك: {qr.selectedText}{qr.showCorrectText ? ` — الصحيحة: ${qr.correctText}` : ''}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>{qr.explanation}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {vm.showDashboardDetail && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={backToDashboardList} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للاختبارات</button>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{vm.dashboardTestName}</span>
          </div>

          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الدقة حسب المجال</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
              {vm.labelStatRows.map((l) => (
                <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--sand)' }}>{l.name} <span style={{ color: 'var(--mist)' }}>· {l.testName}</span></span>
                    <span style={l.pctStyle}>{l.statText}</span>
                  </div>
                  <Bar value={l.barVal} tone={l.tone} height={6} style={{ height: '6px' }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>اتجاه الأداء — 8 أسابيع</h2>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
                {vm.trendBars.map((b, i) => (
                  <div key={i} style={b.style} />
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاتساق</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {vm.heatmapCells.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                    {week.map((day, di) => (
                      <div key={di} style={day} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>السرعة مقابل الهدف</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 28px' }}>
              {vm.labelStatRows.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', ...lineStyle }}>
                  <span style={{ color: 'var(--sand)' }}>{l.name}</span>
                  <span style={l.speedStyle}>{l.speedText}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>أخطاء حديثة</h2>
            {vm.recentMistakeRows.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px', ...lineStyle }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>{m.stem}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', fontWeight: 500, color: 'var(--coral)' }}>الصحيح: {m.correctText}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>{m.explanation}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
            <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>تحليل الأداء</h2>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>{vm.analysisAdvice}</p>
            </div>
            <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاشتراك</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--mist)' }}>الباقة</span><span style={{ color: 'var(--sand)' }}>{vm.subPackage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--mist)' }}>السعر</span><span style={{ color: 'var(--sand)', fontFamily: 'var(--font-latin)' }}>{vm.subPrice} ريال</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--mist)' }}>التجديد</span><span style={{ color: 'var(--sand)', fontFamily: 'var(--font-latin)' }}>{vm.subRenewsOn}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--mist)' }}>الحالة</span><span style={{ color: 'var(--teal-ink)' }}>{vm.subStatus}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
