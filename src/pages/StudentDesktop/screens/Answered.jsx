import { Button } from '../../../design-system/components/Button';
import { AnswerState } from '../../../design-system/components/AnswerState';

export default function Answered({ vm, nextQuestion }) {
  return (
    <>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{vm.activeTestName} · سؤال {vm.qNumber} من {vm.qTotal}</span>
      <p style={{ margin: 0, maxWidth: '640px', fontFamily: 'var(--font-arabic)', fontSize: 'var(--text-body-ar-size)', lineHeight: 'var(--text-body-ar-leading)', color: 'var(--sand)' }}>{vm.currentStem}</p>
      <div style={{ maxWidth: '640px' }}>
        <AnswerState status={vm.answerStatus} correctAnswer={vm.correctOptionText} reason={vm.currentExplanation} />
      </div>
      <Button variant="primary" onClick={nextQuestion}>{vm.nextButtonLabel}</Button>
    </>
  );
}
