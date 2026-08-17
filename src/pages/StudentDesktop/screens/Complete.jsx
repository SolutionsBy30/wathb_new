import { Button } from '../../../design-system/components/Button';
import { StreakStrip } from '../../../design-system/components/StreakStrip';
import { RuleSpark } from '../../../design-system/components/RuleSpark';

export default function Complete({ vm, goDashboard, backHome, onStartNew, dailyLimitReached }) {
  return (
    <>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{vm.activeTestName}</span>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>ملخص الوثبة</h1>
      <p style={{ margin: '-8px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--mist)' }}>{vm.completeHeadline}</p>

      {/* STU-032 — the next leap is the thing a student most wants from this
          screen, so it sits at the top rather than below the breakdown. It
          is offered, not promised: today() hands back the finished bundle
          once the package's daily limit is spent, and dailyLimitReached
          turns that refusal into a sentence instead of a button that looks
          broken. */}
      {onStartNew && !dailyLimitReached && (
        <Button variant="primary" fullWidth onClick={onStartNew}>ابدأ وثبة جديدة</Button>
      )}
      {dailyLimitReached && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>
            أكملت وثبات اليوم في باقتك. نراك غداً بوثبة جديدة.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>صحيحة</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: 'var(--sand)' }}>{vm.sessionCorrect}/{vm.qTotal}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: 'var(--lime)' }}>{vm.streakCount}</span>
        </div>
      </div>

      <StreakStrip days={vm.streakDays} style={{ height: '26px' }} />

      <RuleSpark surface="dark" />

      {vm.labelRows.length > 0 && (
        <>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>أداؤك حسب التصنيف مقارنة بسابقك</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {vm.labelRows.map((lr) => (
              <div key={lr.labelId ?? lr.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{lr.name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }}>{lr.nowPct}%</span>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: lr.deltaColor }}>{lr.deltaText}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Button variant="secondary" fullWidth onClick={goDashboard}>لوحة الأداء</Button>
      <button onClick={backHome} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '13px', cursor: 'pointer' }}>الرئيسية</button>
    </>
  );
}
