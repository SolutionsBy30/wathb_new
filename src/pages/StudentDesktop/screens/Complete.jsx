import { Button } from '../../../design-system/components/Button';
import { StreakStrip } from '../../../design-system/components/StreakStrip';
import { RuleSpark } from '../../../design-system/components/RuleSpark';

export default function Complete({ vm, goDashboard, backHome }) {
  return (
    <>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{vm.activeTestName}</span>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>ملخص الوثبة</h1>
      <p style={{ margin: '-8px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--mist)' }}>{vm.completeHeadline}</p>

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

      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        غداً وثبة جديدة — تدريب إضافي عند الطلب جزء من مرحلة لاحقة.
      </p>

      <Button variant="primary" fullWidth onClick={goDashboard}>لوحة التحكم</Button>
      <button onClick={backHome} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '13px', cursor: 'pointer' }}>الرئيسية</button>
    </>
  );
}
