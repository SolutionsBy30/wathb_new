import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StreakStrip } from '../../design-system/components/StreakStrip';
import markOnIndigo from '../../design-system/assets/mark-on-indigo.svg';
import './layout.css';
import { api, getToken, setToken } from '../../api/client';
import Login from './screens/Login';
import GoalSetup from './screens/GoalSetup';
import Home from './screens/Home';
import Question from './screens/Question';
import Explanations from './screens/Explanations';
import Complete from './screens/Complete';
import Performance from './screens/Performance';
import Profile from './screens/Profile';

function navBtnStyle(active) {
  return {
    textAlign: 'start', border: 'none', cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: active ? 500 : 400,
    color: active ? 'var(--sand)' : 'var(--mist)', background: active ? 'var(--on-indigo-subtle)' : 'transparent',
  };
}

export default function StudentDesktop() {
  const [screen, setScreen] = useState('loading');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [goalBusy, setGoalBusy] = useState(false);
  const [tests, setTests] = useState([]);
  const [student, setStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [wathb, setWathb] = useState(null);
  const [qIndex, setQIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [wathbError, setWathbError] = useState(null);
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false);
  const [completeResult, setCompleteResult] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const timerRef = useRef(null);
  const submittingRef = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const loadReport = useCallback(async (userId) => {
    try {
      setReport(await api.report(userId));
    } catch {
      // report can genuinely be empty/inaccessible before the first Wathb — non-fatal.
    }
  }, []);

  const bootstrap = useCallback(async () => {
    // A tap on a WhatsApp magic link lands here as #magic=<token> (see
    // api/src/notifications/notifications.service.ts) — exchange it for a
    // scoped session exactly like the dev-login flow does, then drop it from
    // the URL so the raw token doesn't sit in browser history (spec §7.1).
    const hashMatch = window.location.hash.match(/^#magic=(.+)$/);
    if (hashMatch) {
      try {
        const { token: sessionToken } = await api.exchangeMagicLink(hashMatch[1]);
        setToken(sessionToken);
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        setToken(null);
      }
    }

    if (!getToken()) {
      setScreen('login');
      return;
    }
    try {
      const me = await api.me();
      setStudent(me);
      if (!me.targetTestId) {
        setTests(await api.listTests());
        setScreen('goal');
      } else {
        await loadReport(me.userId);
        setScreen('home');
      }
    } catch {
      setToken(null);
      setScreen('login');
    }
  }, [loadReport]);

  useEffect(() => {
    bootstrap();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (mobile) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const { token: magicToken } = await api.devRequestLink(mobile, 'student');
      const { token: sessionToken } = await api.exchangeMagicLink(magicToken);
      setToken(sessionToken);
      await bootstrap();
    } catch (e) {
      setLoginError(e.message || 'تعذّر الدخول');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleGoalSubmit = async (dto) => {
    setGoalBusy(true);
    try {
      await api.setGoal(dto);
      const me = await api.me();
      setStudent(me);
      await loadReport(me.userId);
      setScreen('home');
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setGoalBusy(false);
    }
  };

  const startTimerFor = useCallback((seconds, onExpire) => {
    stopTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          onExpire();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const submitAnswer = useCallback(async (wathbId, position, selectedKey, allQuestions) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    stopTimer();
    try {
      const { nextPosition } = await api.answer(wathbId, position, selectedKey);
      if (nextPosition == null) {
        const result = await api.complete(wathbId);
        setCompleteResult(result);
        setScreen('explanations');
      } else {
        setQIndex(nextPosition);
        setSelectedIndex(null);
        const nextQ = allQuestions[nextPosition];
        startTimerFor(nextQ.timeLimitS, () => submitAnswer(wathbId, nextPosition, null, allQuestions));
      }
    } catch (e) {
      setWathbError(e.message);
    } finally {
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, startTimerFor]);

  const startWathb = async () => {
    setWathbError(null);
    setAlreadyDoneToday(false);
    try {
      const result = await api.today();
      if (result.status === 'completed') {
        setAlreadyDoneToday(true);
        return;
      }
      setWathb(result);
      const pos = result.currentPosition ?? 0;
      setQIndex(pos);
      setSelectedIndex(null);
      setScreen('question');
      startTimerFor(result.questions[pos].timeLimitS, () => submitAnswer(result.wathbId, pos, null, result.questions));
    } catch (e) {
      setWathbError(e.message);
    }
  };

  const confirmAnswer = () => {
    if (selectedIndex === null || !wathb) return;
    const q = wathb.questions[qIndex];
    const key = q.options[selectedIndex].key;
    submitAnswer(wathb.wathbId, qIndex, key, wathb.questions);
  };

  const goHome = async () => {
    setWathb(null);
    setCompleteResult(null);
    if (student) await loadReport(student.userId);
    setScreen('home');
  };

  const goPerformance = async () => {
    if (student) await loadReport(student.userId);
    setScreen('performance');
  };

  const goProfile = async () => {
    try {
      setSupervisors(await api.listMySupervisors());
    } catch {
      /* non-fatal */
    }
    setScreen('profile');
  };

  const inviteSupervisor = async (mobile, name, type) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await api.inviteSupervisor(mobile, name, type);
      setSupervisors(await api.listMySupervisors());
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const revokeSupervisor = async (id) => {
    await api.revokeSupervisor(id);
    setSupervisors(await api.listMySupervisors());
  };

  const homeVm = useMemo(() => {
    const weeklyTarget = 35;
    const weeklyAnswered = report?.totals?.weekAnswered ?? 0;
    const worstArea = report?.accuracyByArea?.filter((a) => !a.collecting).sort((a, b) => a.accuracy - b.accuracy)[0];
    return {
      homeHeadline: alreadyDoneToday ? 'راح تكون هنا غداً وثبة جديدة.' : 'اختر وثبة اليوم.',
      dailyTip: worstArea
        ? { labelName: worstArea.nameAr, text: `دقتك في «${worstArea.nameAr}» ${Math.round(worstArea.accuracy * 100)}% — راجع الشرح بعد كل إجابة خاطئة قبل الانتقال للسؤال التالي.` }
        : { labelName: 'وثبة اليوم', text: 'أكمل وثبتك اليومية لبناء ملف نقاط القوة والضعف الخاص بك.' },
      weeklyAnswered, weeklyTarget,
      weeklyPct: Math.round((weeklyAnswered / weeklyTarget) * 100),
      alreadyDoneToday,
      todayScoreText: completeResult ? `أجبت ${completeResult.correctCount} من ${completeResult.total} إجابة صحيحة.` : '',
      startButtonLabel: alreadyDoneToday ? 'أُنجزت وثبة اليوم' : 'ابدأ الوثبة',
    };
  }, [report, alreadyDoneToday, completeResult]);

  const questionVm = useMemo(() => {
    if (!wathb) return null;
    const q = wathb.questions[qIndex];
    return {
      activeTestName: wathb.bundleType === 'placement' ? 'وثبة تحديد المستوى' : 'وثبة اليوم',
      qNumber: qIndex + 1, qTotal: wathb.questions.length,
      timeLeft, timerStyle: { fontFamily: 'var(--font-latin)', fontSize: '13px', color: timeLeft <= 10 ? 'var(--coral)' : 'var(--mist)' },
      progressDots: wathb.questions.map((_, i) => ({
        flex: 1, height: '4px', borderRadius: '2px',
        background: i < qIndex ? 'var(--lime)' : i === qIndex ? 'var(--sand)' : 'var(--on-indigo-subtle)',
      })),
      currentStem: q.stem,
      currentOptions: q.options.map((o) => o.text),
      selectedIndex,
      confirmDisabled: selectedIndex === null,
    };
  }, [wathb, qIndex, timeLeft, selectedIndex]);

  const completeVm = useMemo(() => {
    if (!completeResult) return null;
    return {
      activeTestName: wathb?.bundleType === 'placement' ? 'وثبة تحديد المستوى' : 'وثبة اليوم',
      completeHeadline: completeResult.correctCount === completeResult.total ? 'إجابات كاملة. وثبة نظيفة.' : 'وثبة مكتملة.',
      sessionCorrect: completeResult.correctCount, qTotal: completeResult.total,
      streakCount: completeResult.streak,
    };
  }, [completeResult, wathb]);

  if (screen === 'loading') {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</span>
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '440px', padding: '32px' }}>
          <Login onSubmit={handleLogin} error={loginError} busy={loginBusy} />
        </div>
      </div>
    );
  }

  if (screen === 'goal') {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '440px', padding: '32px' }}>
          <GoalSetup tests={tests} onSubmit={handleGoalSubmit} busy={goalBusy} />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', justifyContent: 'center' }}>
      <div className="sd-shell">
        <aside className="sd-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={markOnIndigo} alt="وثب" style={{ width: '36px', height: '33px' }} />
            <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب</span>
          </div>

          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{student?.user?.name}</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{student?.targetTest?.nameAr}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{report?.streak?.current ?? 0}</span>
            </div>
            <StreakStrip days={Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(report?.streak?.current ?? 0, 7))} style={{ width: '100%', height: '26px' }} />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={goHome} style={navBtnStyle(screen === 'home')}>الرئيسية</button>
            <button onClick={goPerformance} style={navBtnStyle(screen === 'performance')}>لوحتي</button>
            <button onClick={goProfile} style={navBtnStyle(screen === 'profile')}>ملفي</button>
          </nav>
        </aside>

        <main className="sd-main" style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-lg)' }}>
          {wathbError && (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{wathbError}</p>
          )}
          {screen === 'home' && <Home vm={homeVm} goTestPicker={startWathb} />}
          {screen === 'question' && questionVm && (
            <Question vm={questionVm} selectOption={setSelectedIndex} confirmAnswer={confirmAnswer} />
          )}
          {screen === 'explanations' && completeResult && (
            <Explanations result={completeResult} onContinue={() => setScreen('complete')} />
          )}
          {screen === 'complete' && completeVm && (
            <Complete vm={completeVm} goDashboard={goPerformance} backHome={goHome} />
          )}
          {screen === 'performance' && <Performance report={report} />}
          {screen === 'profile' && (
            <Profile
              student={student}
              supervisors={supervisors}
              onInvite={inviteSupervisor}
              onRevoke={revokeSupervisor}
              inviteBusy={inviteBusy}
              inviteError={inviteError}
            />
          )}
        </main>
      </div>
    </div>
  );
}
