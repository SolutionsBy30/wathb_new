import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, mediaUrl } from '../../../api/client';
import { clockTone, formatClock, toArabicDigits, useSectionClock } from './useSectionClock';
import Scratchpad from './Scratchpad';

const PARTS = { verbal: 'لفظي', quantitative: 'كمي', mixed: 'مختلط' };

/** §5.4 — state is persisted on every answer and on a 10s heartbeat. */
const HEARTBEAT_MS = 10_000;

/**
 * SIM-012 — §6 the exam takeover.
 *
 * Rendered outside the app shell on purpose: §6 asks for a screen that "feels
 * like an exam, not like the daily app", so there is no bottom nav, no upgrade
 * banner and no way out that is not part of the exam.
 *
 * The component holds no authority. Every answer, flag and section end is a
 * request, and the screen re-renders from whatever the server returns — the
 * countdown is decoration over a deadline the server owns.
 */
export default function SimulationRunner({ state, onState, onExit }) {
  const attemptId = state?.attempt?.id;
  const section = state?.section ?? null;
  const questions = state?.questions ?? [];
  const blueprint = state?.blueprint ?? null;

  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [scratchpad, setScratchpad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Time on the current question, for §7.2's pacing report. Only the browser
  // can know this under free navigation; the server clamps whatever we send
  // and never lets it touch the score.
  const shownAtRef = useRef(Date.now());
  const spentRef = useRef({});

  const refresh = useCallback(async () => {
    try {
      onState(await api.simulationAttempt());
    } catch (e) {
      setError(e.message);
    }
  }, [onState]);

  const remainingMs = useSectionClock(section?.expiresAt, refresh);
  const tone = clockTone(remainingMs);
  // §5.1 forbids a modal at the warning marks, and a colour shift alone is
  // invisible to a screen reader. One polite announcement at each threshold
  // costs no exam time and is the app's existing NFR-014 pattern.
  const [timeAnnouncement, setTimeAnnouncement] = useState('');
  const announcedRef = useRef(new Set());
  useEffect(() => { announcedRef.current = new Set(); setTimeAnnouncement(''); }, [section?.index]);
  useEffect(() => {
    for (const mark of [5, 1]) {
      if (remainingMs > 0 && remainingMs <= mark * 60_000 && !announcedRef.current.has(mark)) {
        announcedRef.current.add(mark);
        setTimeAnnouncement(mark === 1 ? 'تبقّت دقيقة واحدة في هذا القسم' : 'تبقّت خمس دقائق في هذا القسم');
      }
    }
  }, [remainingMs]);

  // Once the window closes the server rejects everything anyway; leaving the
  // options live would let a student tap, see the answer land optimistically,
  // and then watch it vanish when the refresh corrects it.
  const timeUp = remainingMs <= 0;

  // A new section resets the cursor and the review screen; without this the
  // student lands on question 14 of a section they have just started.
  useEffect(() => {
    setIndex(0);
    setReviewing(false);
    setConfirmEnd(false);
    shownAtRef.current = Date.now();
    spentRef.current = {};
  }, [section?.index]);

  // §5.4 — heartbeat, so an abandoned attempt is dated from the last sign of
  // life rather than from the section start.
  useEffect(() => {
    if (!attemptId || !section) return undefined;
    const id = setInterval(() => { api.simulationEvent(attemptId, 'heartbeat').catch(() => {}); }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [attemptId, section?.index]);

  // §5.3 — blur/tab-switch is logged, never blocking, and surfaced in the
  // report as عدد مرات الخروج من الشاشة.
  useEffect(() => {
    if (!attemptId || !section) return undefined;
    const onVisibility = () => {
      api.simulationEvent(attemptId, document.hidden ? 'focus_lost' : 'focus_regained').catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [attemptId, section?.index]);

  const current = questions[index] ?? null;

  const noteTime = useCallback(() => {
    if (!current) return 0;
    const delta = Date.now() - shownAtRef.current;
    spentRef.current[current.formItemId] = (spentRef.current[current.formItemId] ?? 0) + delta;
    shownAtRef.current = Date.now();
    return spentRef.current[current.formItemId];
  }, [current]);

  /** Move without billing the elapsed time to anything — used when the clock
   *  was already stopped, e.g. coming back from the review screen. */
  const jumpTo = (i) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
    shownAtRef.current = Date.now();
  };

  /** Move within the question screen: the time since the last move belongs to
   *  the question being left. */
  const goTo = (i) => {
    noteTime();
    jumpTo(i);
  };

  const select = async (key) => {
    if (!current || busy || timeUp) return;
    const spent = noteTime();
    // Optimistic: the exam has to feel immediate, and a rejected write is
    // corrected by the refresh below. Nothing here decides correctness.
    onState({
      ...state,
      questions: questions.map((q) => (q.formItemId === current.formItemId ? { ...q, selectedKey: key } : q)),
    });
    try {
      await api.answerSimulation(attemptId, current.formItemId, key, spent);
    } catch (e) {
      setError(e.message);
      refresh();
    }
  };

  const toggleFlag = async () => {
    if (!current || timeUp) return;
    const next = !current.flagged;
    onState({
      ...state,
      questions: questions.map((q) => (q.formItemId === current.formItemId ? { ...q, flagged: next } : q)),
    });
    try {
      await api.flagSimulationItem(attemptId, current.formItemId, next);
    } catch (e) {
      setError(e.message);
      refresh();
    }
  };

  const endSection = async () => {
    setBusy(true);
    setError(null);
    try {
      noteTime();
      onState(await api.submitSimulationSection(attemptId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const beginSection = async () => {
    setBusy(true);
    setError(null);
    try {
      onState(await api.beginSimulationSection(attemptId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const answeredCount = useMemo(() => questions.filter((q) => q.selectedKey !== null).length, [questions]);
  const flaggedCount = useMemo(() => questions.filter((q) => q.flagged).length, [questions]);

  // ------------------------------------------------------------- finished

  if (state && state.attempt === null) {
    // The attempt is gone (finalized elsewhere, or never existed). Spinning
    // on "جارٍ التحضير" would strand the student inside a takeover with no
    // way out.
    return (
      <div className="sim-root sim-center">
        <div className="sim-panel">
          <p className="sim-body">لا توجد محاولة مفتوحة.</p>
          <button type="button" className="sim-btn sim-btn-primary" onClick={onExit}>العودة إلى وثب</button>
        </div>
      </div>
    );
  }

  if (state?.attempt && state.attempt.status && state.attempt.status !== 'in_progress') {
    return (
      <div className="sim-root sim-center">
        <div className="sim-panel">
          <h1 className="sim-h1">انتهى المحاكي</h1>
          <p className="sim-body">
            {state.attempt.status === 'completed'
              ? 'أنهيت جميع الأقسام. تقريرك قيد التجهيز وسيصلك عبر واتساب.'
              : 'أُغلقت المحاولة. ستجد ما أجبت عنه في تقريرك.'}
          </p>
          <button type="button" className="sim-btn sim-btn-primary" onClick={onExit}>العودة إلى وثب</button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------- section intro

  if (!section) {
    const pending = state?.pendingSection;
    if (!pending) {
      return (
        <div className="sim-root sim-center">
          <div className="sim-panel">
            <p className="sim-body">جارٍ التحضير…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="sim-root sim-center">
        <div className="sim-panel">
          <span className="sim-label">{blueprint?.nameAr}</span>
          <h1 className="sim-h1">القسم {toArabicDigits(pending.index + 1)} من {toArabicDigits(pending.of)}</h1>
          <p className="sim-lede">
            {PARTS[pending.part] ?? pending.part} · {toArabicDigits(pending.questionCount)} سؤالًا ·{' '}
            {toArabicDigits(Math.round(pending.durationS / 60))} دقيقة
          </p>
          {/* §5.1 — no global pause, and the student should know before the
              clock starts rather than discover it afterwards. */}
          <p className="sim-warn">الوقت يبدأ عند الضغط ولن يتوقف.</p>
          {error && <p className="sim-error">{error}</p>}
          <button type="button" className="sim-btn sim-btn-primary" onClick={beginSection} disabled={busy}>
            {busy ? 'جارٍ البدء…' : 'ابدأ القسم'}
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------- review screen

  if (reviewing) {
    return (
      <div className="sim-root">
        <header className="sim-bar">
          <span className="sim-label">القسم {toArabicDigits(section.index + 1)} من {toArabicDigits(section.of)}</span>
          <span className={`sim-clock sim-clock-${tone}`}>{formatClock(remainingMs)}</span>
        </header>

        <div className="sim-review">
          <h2 className="sim-h2">مراجعة القسم</h2>
          <p className="sim-body">
            أجبت عن {toArabicDigits(answeredCount)} من {toArabicDigits(questions.length)}
            {flaggedCount > 0 ? ` · ${toArabicDigits(flaggedCount)} مميّزة للمراجعة` : ''}
          </p>

          <div className="sim-grid">
            {questions.map((q, i) => (
              <button
                key={q.formItemId}
                type="button"
                onClick={() => { setReviewing(false); jumpTo(i); }}
                className={[
                  'sim-cell',
                  q.selectedKey !== null ? 'answered' : 'unanswered',
                  q.flagged ? 'flagged' : '',
                ].join(' ')}
                aria-label={`سؤال ${i + 1}${q.selectedKey !== null ? '، مُجاب' : '، بدون إجابة'}${q.flagged ? '، مميّز' : ''}`}
              >
                {toArabicDigits(i + 1)}
              </button>
            ))}
          </div>

          <div className="sim-legend">
            <span><i className="sim-dot answered" /> مُجاب</span>
            <span><i className="sim-dot unanswered" /> بدون إجابة</span>
            <span><i className="sim-dot flagged" /> مميّز للمراجعة</span>
          </div>

          {error && <p className="sim-error">{error}</p>}

          {!confirmEnd ? (
            <div className="sim-actions">
              <button type="button" className="sim-btn" onClick={() => { setReviewing(false); jumpTo(index); }}>العودة للأسئلة</button>
              <button type="button" className="sim-btn sim-btn-primary" onClick={() => setConfirmEnd(true)}>إنهاء القسم</button>
            </div>
          ) : (
            <div className="sim-confirm">
              {/* §5.2 — confirmation warns on the unanswered count. There is
                  no way back into a section once it closes. */}
              <p className="sim-warn">
                {answeredCount < questions.length
                  ? `لديك ${toArabicDigits(questions.length - answeredCount)} سؤالًا بدون إجابة. لا يمكن العودة إلى هذا القسم بعد إنهائه.`
                  : 'لا يمكن العودة إلى هذا القسم بعد إنهائه.'}
              </p>
              <div className="sim-actions">
                <button type="button" className="sim-btn" onClick={() => setConfirmEnd(false)}>تراجع</button>
                <button type="button" className="sim-btn sim-btn-danger" onClick={endSection} disabled={busy}>
                  {busy ? 'جارٍ الإنهاء…' : 'تأكيد الإنهاء'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------ question screen

  const options = Array.isArray(current?.options) ? current.options : [];
  const linear = blueprint?.navigationPolicy === 'linear_only';

  return (
    <div className="sim-root">
      <span className="sd-sr-only" role="status" aria-live="polite">{timeAnnouncement}</span>
      <header className="sim-bar">
        <span className="sim-label">
          {blueprint?.nameAr} · القسم {toArabicDigits(section.index + 1)} من {toArabicDigits(section.of)} · {PARTS[section.part] ?? section.part}
        </span>
        <span className="sim-label">{toArabicDigits(index + 1)} / {toArabicDigits(questions.length)}</span>
        <span className={`sim-clock sim-clock-${tone}`} role="timer" aria-live="off">{formatClock(remainingMs)}</span>
      </header>

      {current && (
        // §5.3 — no copy/paste on question text. A determined student can
        // still read it off the screen; this stops the casual lift into a
        // search box, which is the realistic case.
        <main className={`sim-question${current.passage ? ' sim-question-split' : ''}`} onCopy={(e) => e.preventDefault()}>
          {current.passage && (
            <aside className="sim-passage" dir="auto">
              <span className="sim-label">القطعة</span>
              <div className="sim-passage-body">{current.passage.body}</div>
            </aside>
          )}

          <div className="sim-stem-col">
            <p className="sim-stem" dir="auto">{current.stem}</p>
            {current.stemImageUrl && (
              <img className="sim-stem-img" src={mediaUrl(current.stemImageUrl)} alt="صورة السؤال" />
            )}

            <div className="sim-options" role="radiogroup">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={current.selectedKey === opt.key}
                  className={`sim-option${current.selectedKey === opt.key ? ' selected' : ''}`}
                  onClick={() => select(opt.key)}
                  disabled={timeUp}
                  dir="auto"
                >
                  {opt.imageUrl && <img src={mediaUrl(opt.imageUrl)} alt="" className="sim-option-img" />}
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {error && <p className="sim-error">{error}</p>}

      <nav className="sim-strip" aria-label="أسئلة القسم">
        {questions.map((q, i) => (
          <button
            key={q.formItemId}
            type="button"
            onClick={() => goTo(i)}
            disabled={linear && i !== index}
            className={[
              'sim-pip',
              i === index ? 'current' : '',
              q.selectedKey !== null ? 'answered' : '',
              q.flagged ? 'flagged' : '',
            ].join(' ')}
            aria-label={`سؤال ${i + 1}`}
          >
            {toArabicDigits(i + 1)}
          </button>
        ))}
      </nav>

      <footer className="sim-foot">
        <button type="button" className="sim-btn" onClick={() => goTo(index - 1)} disabled={linear || index === 0}>
          السابق
        </button>
        {blueprint?.allowFlagReview && (
          <button type="button" className={`sim-btn${current?.flagged ? ' sim-btn-flagged' : ''}`} onClick={toggleFlag}>
            {current?.flagged ? 'إلغاء التمييز' : 'تمييز للمراجعة'}
          </button>
        )}
        {blueprint?.scratchpad === 'digital' && (
          <button
            type="button"
            className="sim-btn"
            onClick={() => {
              setScratchpad(true);
              api.simulationEvent(attemptId, 'scratchpad_open').catch(() => {});
            }}
          >
            المسودة
          </button>
        )}
        <button type="button" className="sim-btn" onClick={() => goTo(index + 1)} disabled={index >= questions.length - 1}>
          التالي
        </button>
        <button type="button" className="sim-btn sim-btn-primary" onClick={() => { noteTime(); setReviewing(true); }}>
          مراجعة وإنهاء
        </button>
      </footer>

      <Scratchpad open={scratchpad} onClose={() => setScratchpad(false)} />
    </div>
  );
}
