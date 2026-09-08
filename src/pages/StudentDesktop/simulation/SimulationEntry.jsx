import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Button } from '../../../design-system/components/Button';
import { toArabicDigits } from './useSectionClock';

const label = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };
const body = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', margin: 0, lineHeight: 1.7 };
const card = {
  background: 'var(--on-indigo-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

/** A gate the student has not cleared yet, as progress rather than a lock. */
function GateBar({ done, need, text }) {
  const ratio = need === 0 ? 1 : Math.min(1, done / need);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={label}>{text}</span>
      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--on-indigo-line)', overflow: 'hidden' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: ratio >= 1 ? 'var(--lime)' : 'var(--teal)' }} />
      </div>
    </div>
  );
}

/**
 * SIM-013 — §6.1 pre-exam, and §5.6's locked state.
 *
 * The locked state is the important half of this screen. §5.6 is explicit that
 * it must never be a bare "مقفل": a student who has paid and cannot open the
 * thing they paid for needs to see exactly how far off they are and what
 * closes the gap. So every unmet condition is shown with its own counter, and
 * the cooldown shows its unlock date.
 */
export default function SimulationEntry({ onEnter, onExit, onOpenReport, studentId }) {
  const [items, setItems] = useState(null);
  const [live, setLive] = useState(null);
  const [past, setPast] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    // §5.4 — one active attempt per student. Listing blueprints while a
    // section is running would offer a start button that can only be refused,
    // so an open attempt takes over the screen and offers to resume instead.
    api.simulationAttempt()
      .then((state) => {
        if (state?.attempt && state.attempt.status === 'in_progress') setLive(state);
      })
      .catch(() => {});
    api.simulationsAvailable()
      .then(setItems)
      .catch((e) => { setError(e.message); setItems([]); });
    if (studentId) api.simulationReports(studentId).then(setPast).catch(() => {});
  }, [studentId]);

  const start = async (blueprintId) => {
    setBusyId(blueprintId);
    setError(null);
    try {
      onEnter(await api.startSimulation(blueprintId));
    } catch (e) {
      setError(e.message);
      setConfirming(null);
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) {
    return <p style={body}>جارٍ التحميل…</p>;
  }

  if (live) {
    return (
      <div style={{ ...card, maxWidth: '520px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 600, color: 'var(--sand)' }}>
          لديك محاكٍ قيد التنفيذ
        </span>
        {/* The clock has not stopped while they were away, so this is urgent
            rather than a neutral "continue where you left off". */}
        <span style={{ ...body, color: 'var(--coral)' }}>الوقت ما زال يعمل — تابع الآن.</span>
        <Button variant="primary" onClick={() => onEnter(live)}>متابعة المحاكي</Button>
        <button onClick={onExit} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
          لاحقًا
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 600, color: 'var(--sand)' }}>
          المحاكي
        </h1>
        <button onClick={onExit} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
          رجوع
        </button>
      </div>

      <p style={{ ...body, color: 'var(--mist)' }}>
        اختبار كامل بنفس ظروف القياس — نفس عدد الأقسام، ونفس التوقيت، ونفس ترتيب الصعوبة. ليس تدريبًا يوميًا.
      </p>

      {error && <p style={{ ...body, color: 'var(--coral)' }}>{error}</p>}

      {items.length === 0 && <p style={body}>لا يوجد محاكٍ متاح لاختبارك حاليًا.</p>}

      {items.map((bp) => {
        const a = bp.access;
        const p = a.eligibility.progress;
        const confirmingThis = confirming === bp.id;

        return (
          <div key={bp.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 600, color: 'var(--sand)' }}>{bp.nameAr}</span>
              <span style={label}>{bp.test?.nameAr}</span>
            </div>

            <span style={label}>
              {toArabicDigits(bp.sectionCount)} أقسام · {toArabicDigits(bp.totalQuestions)} سؤالًا ·{' '}
              {toArabicDigits(Math.round(bp.sectionDurationS / 60))} دقيقة لكل قسم
            </span>

            {a.canStart ? (
              <>
                {/* §6.1 — the rules, stated before the clock exists. */}
                <ul style={{ ...body, margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>الوقت لا يتوقف — إغلاق الصفحة لا يوقف العدّاد.</li>
                  <li>لا يمكن الرجوع إلى قسم بعد انتهائه.</li>
                  <li>{bp.calculatorAllowed ? 'الآلة الحاسبة مسموحة.' : 'الآلة الحاسبة غير مسموحة.'}</li>
                  <li>لا تظهر الإجابات الصحيحة ولا الشروح إلا بعد التسليم.</li>
                </ul>

                {/* §5.5 — the attempt is spent on start, not on completion, and
                    the student is told so before they spend it. */}
                <span style={{ ...label, color: 'var(--sand)' }}>
                  تُحتسب المحاولة عند البدء وليس عند الإنهاء · متبقٍ لك{' '}
                  {toArabicDigits(a.entitlement.remaining)} من {toArabicDigits(a.entitlement.included)}
                </span>

                {!confirmingThis ? (
                  <Button variant="primary" onClick={() => setConfirming(bp.id)}>ابدأ المحاكي</Button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ ...label, color: 'var(--coral)' }}>
                      بمجرد البدء يعمل العدّاد ولا يمكن إيقافه. جهّز مكانًا هادئًا و{toArabicDigits(Math.round((bp.sectionCount * bp.sectionDurationS) / 60))} دقيقة دون انقطاع.
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="secondary" onClick={() => setConfirming(null)}>ليس الآن</Button>
                      <Button variant="primary" onClick={() => start(bp.id)} disabled={busyId === bp.id}>
                        {busyId === bp.id ? 'جارٍ البدء…' : 'أنا جاهز — ابدأ'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ ...body, color: 'var(--sand)' }}>{a.blockedAr}</span>

                {/* Progress, not a padlock. Only the gates that are actually
                    configured are shown — a blueprint with no question
                    threshold should not display a bar reading 0 of 0. */}
                {p.requiredLeaps > 0 && (
                  <GateBar
                    done={p.completedLeaps}
                    need={p.requiredLeaps}
                    text={`الوثبات المكتملة: ${toArabicDigits(p.completedLeaps)} من ${toArabicDigits(p.requiredLeaps)}`}
                  />
                )}
                {p.requiredQuestions > 0 && (
                  <GateBar
                    done={p.answeredQuestions}
                    need={p.requiredQuestions}
                    text={`الأسئلة المُجابة: ${toArabicDigits(p.answeredQuestions)} من ${toArabicDigits(p.requiredQuestions)}`}
                  />
                )}
                {p.requiredAreas > 0 && (
                  <GateBar
                    done={p.areasCovered}
                    need={p.requiredAreas}
                    text={`المجالات المُغطّاة: ${toArabicDigits(p.areasCovered)} من ${toArabicDigits(p.requiredAreas)}`}
                  />
                )}
                {p.requiredLeapsBetween > 0 && (
                  <GateBar
                    done={p.leapsSinceLastAttempt}
                    need={p.requiredLeapsBetween}
                    text={`وثبات منذ المحاكي السابق: ${toArabicDigits(p.leapsSinceLastAttempt)} من ${toArabicDigits(p.requiredLeapsBetween)}`}
                  />
                )}

                {a.reasonsAr.length > 1 && (
                  <ul style={{ ...label, margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {a.reasonsAr.slice(1).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      {past.length > 0 && (
        <div style={card}>
          <span style={{ ...body, fontWeight: 600 }}>محاولاتك السابقة</span>
          {past.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpenReport(a.id)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', padding: '8px 0',
                borderTop: '0.5px solid var(--on-indigo-line)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline',
              }}
            >
              <span style={{ ...label, color: 'var(--sand)' }}>{a.formCode}</span>
              <span style={label}>{a.blueprintNameAr}</span>
              {a.accuracy !== null && (
                <span style={{ ...label, color: 'var(--sand)' }}>{toArabicDigits(Math.round(a.accuracy))}٪</span>
              )}
              {a.status !== 'completed' && <span style={{ ...label, color: 'var(--coral)' }}>غير مكتملة</span>}
              <span style={{ ...label, marginInlineStart: 'auto' }}>عرض التقرير ←</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
