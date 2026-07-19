import { Button } from '../../../design-system/components/Button';
import { AnswerState } from '../../../design-system/components/AnswerState';

const lineStyle = { borderBottom: '0.5px solid var(--on-indigo-line)' };

// S8 in the spec: correctness is revealed here, all at once, after the bundle
// is finished — never mid-bundle (§6.3), so a wrong answer can't poison focus
// on the next question.
export default function Explanations({ result, onContinue }) {
  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>
        مراجعة الوثبة
      </h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
        أجبت {result.correctCount} من {result.total} إجابة صحيحة.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
        {result.questions.map((q) => {
          const correctText = (q.options || []).find((o) => o.key === q.correctKey)?.text ?? q.correctKey;
          return (
            <div key={q.position} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', ...lineStyle }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>سؤال {q.position + 1}</span>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>{q.stem}</p>
              <AnswerState
                status={q.isCorrect ? 'correct' : 'wrong'}
                correctAnswer={correctText}
                reason={q.explanation}
              />
              {q.timedOut && (
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>انتهى الوقت قبل الإجابة.</span>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="primary" onClick={onContinue}>متابعة</Button>
    </>
  );
}
