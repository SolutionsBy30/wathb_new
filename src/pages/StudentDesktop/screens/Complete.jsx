import { Button } from '../../../design-system/components/Button';

export default function Complete({ vm, goTestPicker, goDashboard, backHome }) {
  return (
    <>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{vm.activeTestName} مكتملة</span>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '26px', fontWeight: 500, color: 'var(--sand)' }}>{vm.completeHeadline}</h1>
      <div style={{ display: 'flex', gap: '36px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>صحيحة</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '28px', fontWeight: 500, color: 'var(--sand)' }}>{vm.sessionCorrect}/{vm.qTotal}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '28px', fontWeight: 500, color: 'var(--lime)' }}>{vm.streakCount}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button variant="primary" onClick={goTestPicker}>ابدأ وثبة جديدة</Button>
        <Button variant="secondary" onClick={goDashboard}>لوحة الأداء</Button>
        <button onClick={backHome} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', fontSize: '13px', cursor: 'pointer' }}>الرئيسية</button>
      </div>
    </>
  );
}
