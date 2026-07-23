import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { AnswerState } from '../../../design-system/components/AnswerState';
import { api } from '../../../api/client';

const lineStyle = { borderBottom: '0.5px solid var(--on-indigo-line)' };

// STU-012 — one-tap 👍/👎 on the explanation, plus a "report a problem"
// action that routes the flag (with the student's answer attached) to the
// admin problem-reports inbox.
function ExplanationFeedback({ answerId }) {
  const [rating, setRating] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [reported, setReported] = useState(false);

  const rate = async (value) => {
    setRating(value);
    try {
      await api.rateExplanation(answerId, value);
    } catch {
      setRating(null); // roll back the optimistic tap on failure
    }
  };

  const submitReport = async () => {
    try {
      await api.reportProblem(answerId, note.trim() || undefined);
      setReported(true);
      setReporting(false);
    } catch {
      /* the tap stays available to retry */
    }
  };

  if (reported) {
    return <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal-ink)' }}>تم إرسال البلاغ، شكراً لك.</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>هل كان الشرح مفيداً؟</span>
        <button
          onClick={() => rate('up')}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '15px', opacity: rating === 'down' ? 0.4 : 1 }}
          aria-label="مفيد"
        >
          👍
        </button>
        <button
          onClick={() => rate('down')}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '15px', opacity: rating === 'up' ? 0.4 : 1 }}
          aria-label="غير مفيد"
        >
          👎
        </button>
        <button
          onClick={() => setReporting((r) => !r)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', marginInlineStart: 'auto' }}
        >
          الإبلاغ عن مشكلة
        </button>
      </div>
      {reporting && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="صف المشكلة (اختياري)…"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          />
          <button
            onClick={submitReport}
            style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--coral)', color: 'var(--indigo)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          >
            إرسال
          </button>
        </div>
      )}
    </div>
  );
}

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
          // ADM-012 — the stem/explanation follow the test's content
          // language; the surrounding chrome (question number, timers) stays app-RTL.
          const contentDir = result.contentLanguage === 'en' ? 'ltr' : 'rtl';
          return (
            <div key={q.position} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', ...lineStyle }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>سؤال {q.position + 1}</span>
              <p dir={contentDir} style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8 }}>{q.stem}</p>
              <div dir={contentDir}>
                <AnswerState
                  status={q.isCorrect ? 'correct' : 'wrong'}
                  correctAnswer={correctText}
                  reason={q.explanation}
                />
              </div>
              {q.timedOut && (
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>انتهى الوقت قبل الإجابة.</span>
              )}
              {(q.cohortMeanTimeMs != null || q.cohortAccuracy != null) && (
                <div style={{ display: 'flex', gap: '14px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                  {q.cohortMeanTimeMs != null && (
                    <span>
                      وقتك {Math.round(q.timeTakenMs / 1000)}ث مقابل متوسط الطلاب {Math.round(q.cohortMeanTimeMs / 1000)}ث
                    </span>
                  )}
                  {q.cohortAccuracy != null && (
                    <span>دقة الطلاب لهذا السؤال: {Math.round(q.cohortAccuracy * 100)}%</span>
                  )}
                </div>
              )}
              {q.answerId && <ExplanationFeedback answerId={q.answerId} />}
            </div>
          );
        })}
      </div>

      <Button variant="primary" onClick={onContinue}>متابعة</Button>
    </>
  );
}
