import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../api/client';

/**
 * ADM-097 — one leap's questions with the student's answers.
 *
 * The point is comparison, so the student's choice and the correct one sit
 * side by side on every row, right or wrong. An unanswered question shows
 * "لم يجب" rather than an empty cell — not answering and answering wrongly
 * are different facts about a student.
 */
export function LeapDetail({ studentId, wathbId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api.leapDetail(studentId, wathbId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [studentId, wathbId]);

  if (error) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>;
  if (!data) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const dir = data.contentLanguage === 'en' ? 'ltr' : 'rtl';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      {data.questions.length === 0 && (
        <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد أسئلة في هذه الوثبة.</p>
      )}

      {data.questions.map((q) => {
        // null = never answered; true/false = answered.
        const unanswered = q.isCorrect === null;
        const tone = unanswered ? 'var(--mist)' : q.isCorrect ? 'var(--teal)' : 'var(--coral)';
        return (
          <div
            key={q.position}
            style={{
              background: 'var(--indigo)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderInlineStart: `2px solid ${tone}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                سؤال {q.position + 1}{q.labelNameAr ? ` · ${q.labelNameAr}` : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: tone }}>
                {unanswered ? (q.timedOut ? 'انتهى الوقت — لم يجب' : 'لم يجب') : q.isCorrect ? 'صحيحة' : 'خاطئة'}
                {q.timeTakenMs != null && (
                  <span style={{ color: 'var(--mist)', fontFamily: 'var(--font-latin)' }}> · {Math.round(q.timeTakenMs / 1000)}s</span>
                )}
              </span>
            </div>

            <p dir={dir} style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.8 }}>{q.stem}</p>
            {q.stemImageUrl && (
              <img src={mediaUrl(q.stemImageUrl)} alt="صورة السؤال" style={{ maxWidth: '320px', borderRadius: 'var(--radius-sm)', background: 'var(--sand)' }} />
            )}

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)' }}>إجابة الطالب</span>
                <span dir={dir} style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: unanswered ? 'var(--mist)' : q.isCorrect ? 'var(--teal)' : 'var(--coral)' }}>
                  {unanswered ? 'لم يجب' : q.selectedText}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)' }}>الإجابة الصحيحة</span>
                <span dir={dir} style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--lime)' }}>{q.correctText}</span>
              </div>
            </div>

            {q.explanation && (
              <p dir={dir} style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.8 }}>
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
