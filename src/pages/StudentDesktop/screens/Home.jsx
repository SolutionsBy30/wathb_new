import { useEffect, useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { Bar } from '../../../design-system/components/Bar';
import { StreakStrip } from '../../../design-system/components/StreakStrip';
import { RuleSpark } from '../../../design-system/components/RuleSpark';
import markOnIndigo from '../../../design-system/assets/mark-on-indigo.svg';

export default function Home({ vm, student, goTestPicker, tests = [], focusedTestId, onOpenHistory }) {
  // STU-002 — with more than one enabled test the student chooses which one
  // this leap is for; with a single test there's nothing to pick, so the
  // selector stays out of the way.
  const [chosenTest, setChosenTest] = useState(focusedTestId ?? tests[0]?.testId);
  useEffect(() => { setChosenTest(focusedTestId ?? tests[0]?.testId); }, [focusedTestId, tests.length]);
  return (
    <div className="sd-split">
      <div className="sd-rail">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={markOnIndigo} alt="وثب" style={{ width: '34px', height: '31px' }} />
          <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '17px', color: 'var(--sand)' }}>وثب</span>
        </div>

        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{student?.user?.name}</span>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
            {student?.targetTest?.nameAr} · {student?.track === 'scientific' ? 'علمي' : student?.track === 'humanities' ? 'أدبي' : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{vm.streakCount}</span>
          </div>
          <StreakStrip days={vm.streakDays} style={{ width: '100%', height: '26px' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>المؤشر المركّب</span>
          {vm.restricted ? (
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>🔒 للباقات المدفوعة</span>
          ) : vm.compositeIndex === null ? (
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>قيد الجمع</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{vm.compositeIndex}</span>
              {vm.compositeIndexDelta !== null && vm.compositeIndexDelta !== 0 && (
                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: vm.compositeIndexDelta > 0 ? 'var(--teal-ink)' : 'var(--coral)' }}>
                  {vm.compositeIndexDelta > 0 ? '↑' : '↓'} {Math.abs(Math.round(vm.compositeIndexDelta * 100))}
                </span>
              )}
            </span>
          )}
        </div>

        <RuleSpark surface="dark" />

        <div style={{ display: 'flex', gap: '20px', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--mist)' }}>إجمالي الأسئلة</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{vm.totalAnswered}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--mist)' }}>صحيحة</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '16px', fontWeight: 500, color: 'var(--teal-ink)' }}>{vm.totalCorrect}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--mist)' }}>خاطئة</span>
            <span style={{ fontFamily: 'var(--font-latin)', fontSize: '16px', fontWeight: 500, color: 'var(--coral)' }}>{vm.totalWrong}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--mist)' }}>
            <span>هذا الأسبوع</span>
            <span>{vm.weeklyAnswered} من {vm.weeklyTarget}</span>
          </div>
          <Bar value={vm.weeklyPct} tone="teal" style={{ height: '8px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{vm.homeHeadline}</h1>

        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--lime)' }}>معلومة تساعدك في {vm.dailyTip.labelName}</span>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>{vm.dailyTip.text}</p>
        </div>

        {vm.alreadyDoneToday && (
          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>أنهيت وثبة اليوم. {vm.todayScoreText}</p>
          </div>
        )}

        {tests.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {tests.map((t) => (
              <button
                key={t.testId}
                onClick={() => setChosenTest(t.testId)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '999px',
                  fontFamily: 'var(--font-arabic)', fontSize: '12px',
                  background: chosenTest === t.testId ? 'var(--lime)' : 'var(--on-indigo-subtle)',
                  color: chosenTest === t.testId ? 'var(--lime-ink)' : 'var(--sand)',
                }}
              >
                {t.nameAr}
              </button>
            ))}
          </div>
        )}
        <Button variant="primary" fullWidth disabled={vm.alreadyDoneToday} onClick={() => goTestPicker(chosenTest)}>{vm.startButtonLabel}</Button>
        {onOpenHistory && (
          <button onClick={onOpenHistory} style={{ marginTop: '10px', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>
            سجل الوثبات ←
          </button>
        )}
      </div>
    </div>
  );
}
