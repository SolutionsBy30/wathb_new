import { Button } from '../../../design-system/components/Button';
import { Bar } from '../../../design-system/components/Bar';

export default function Home({ vm, goTestPicker, resetProgress }) {
  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>{vm.homeHeadline}</h1>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime)' }}>معلومة تساعدك في {vm.dailyTip.labelName}</span>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>{vm.dailyTip.text}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '420px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--mist)' }}>
          <span>هذا الأسبوع</span>
          <span>{vm.weeklyAnswered} من {vm.weeklyTarget}</span>
        </div>
        <Bar value={vm.weeklyPct} tone="teal" style={{ height: '8px' }} />
      </div>

      {vm.alreadyDoneToday && (
        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '16px', maxWidth: '480px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>أنهيت وثبة اليوم. {vm.todayScoreText}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={goTestPicker}>{vm.startButtonLabel}</Button>
        <button onClick={resetProgress} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '12px', cursor: 'pointer' }}>إعادة تعيين النموذج</button>
      </div>
    </>
  );
}
