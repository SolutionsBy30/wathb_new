import { Button } from '../../../design-system/components/Button';
import { QuestionCard } from '../../../design-system/components/QuestionCard';

export default function Question({ vm, selectOption, confirmAnswer }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '640px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{vm.activeTestName} · سؤال {vm.qNumber} من {vm.qTotal}</span>
        <span style={vm.timerStyle}>{vm.timeLeft}ث</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', maxWidth: '640px' }}>
        {vm.progressDots.map((dot, i) => (
          <div key={i} style={dot} />
        ))}
      </div>
      <div style={{ maxWidth: '640px' }}>
        <QuestionCard
          question={vm.currentStem}
          options={vm.currentOptions}
          selected={vm.selectedIndex}
          onSelect={selectOption}
          showLetters={false}
        />
      </div>
      <Button variant="primary" onClick={confirmAnswer} disabled={vm.confirmDisabled}>تأكيد</Button>
    </>
  );
}
