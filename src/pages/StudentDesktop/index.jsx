import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './layout.css';
import { api, getToken, setToken, decodeSession } from '../../api/client';
import Landing from '../Landing';
import Login from './screens/Login';
import GoalSetup from './screens/GoalSetup';
import Home from './screens/Home';
import Question from './screens/Question';
import Explanations from './screens/Explanations';
import Complete from './screens/Complete';
import Performance from './screens/Performance';
import Profile from './screens/Profile';
import Pricing from './screens/Pricing';
import WeeklyReport from './screens/WeeklyReport';

export default function StudentDesktop() {
  const [screen, setScreen] = useState('loading');
  const [loginMode, setLoginMode] = useState('login');
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
  const [subscription, setSubscription] = useState(null);
  const [packages, setPackages] = useState([]);
  const [pricingMessage, setPricingMessage] = useState(null);

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

  const loadSubscription = useCallback(async () => {
    try {
      setSubscription(await api.mySubscription());
    } catch {
      /* non-fatal */
    }
  }, []);

  const bootstrap = useCallback(async () => {
    // A tap on a WhatsApp magic link lands here as #magic=<token> (see
    // api/src/notifications/notifications.service.ts) — exchange it for a
    // scoped session exactly like the dev-login flow does, then drop it from
    // the URL so the raw token doesn't sit in browser history (spec §7.1).
    const hashMatch = window.location.hash.match(/^#magic=(.+)$/);
    let magicPurpose = null;
    if (hashMatch) {
      try {
        const { token: sessionToken } = await api.exchangeMagicLink(hashMatch[1]);
        setToken(sessionToken);
        magicPurpose = decodeSession(sessionToken)?.purpose ?? null;
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        setToken(null);
      }
    }

    if (!getToken()) {
      setScreen('landing');
      return;
    }
    try {
      const me = await api.me();
      setStudent(me);
      await loadSubscription();
      if (window.location.hash === '#subscription=success') {
        // Landed back from a checkout redirect (real Paymob or the dev
        // stand-in) — the subscription is already confirmed server-side by
        // the time this redirect happens.
        window.history.replaceState(null, '', window.location.pathname);
      }
      if (!me.targetTestId) {
        setTests(await api.listTests());
        setScreen('goal');
      } else {
        await loadReport(me.userId);
        // The weekly WhatsApp link (spec S11) lands here, not on Home.
        setScreen(magicPurpose === 'weekly_report' ? 'weeklyReport' : 'home');
      }
    } catch {
      setToken(null);
      setScreen('login');
    }
  }, [loadReport, loadSubscription]);

  useEffect(() => {
    bootstrap();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestOtp = async (mobile) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      return await api.requestOtp(mobile);
    } catch (e) {
      setLoginError(e.message || 'تعذّر إرسال الرمز');
      return null;
    } finally {
      setLoginBusy(false);
    }
  };

  const signupStudent = async (mobile, name) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      return await api.signupStudent(mobile, name);
    } catch (e) {
      setLoginError(e.message || 'تعذّر إنشاء الحساب');
      return null;
    } finally {
      setLoginBusy(false);
    }
  };

  const goLanding = () => setScreen('landing');
  const goLogin = () => { setLoginMode('login'); setScreen('login'); };
  const goSignup = () => { setLoginMode('signup'); setScreen('login'); };

  const verifyOtp = async (mobile, code) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const { token: sessionToken } = await api.verifyOtp(mobile, code);
      setToken(sessionToken);
      await bootstrap();
    } catch (e) {
      setLoginError(e.message || 'رمز غير صحيح');
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
      if (e.message.includes('subscription')) {
        await goPricing('اشتراكك غير فعّال أو منتهٍ — اشترك في باقة لمتابعة وثبتك اليومية.');
      } else {
        setWathbError(e.message);
      }
    }
  };

  const goPricing = async (message) => {
    setPricingMessage(message ?? null);
    try {
      setPackages(await api.listPackages());
    } catch {
      /* non-fatal */
    }
    setScreen('pricing');
  };

  const subscribeToPackage = async (packageId) => {
    const { checkoutUrl } = await api.startCheckout(packageId);
    window.location.href = checkoutUrl;
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
    await loadSubscription();
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
    const streakCount = report?.streak?.current ?? 0;
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
      streakCount,
      streakDays: Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(streakCount, 7)),
      totalAnswered: report?.totals?.lifetimeAnswered ?? 0,
      totalCorrect: report?.totals?.lifetimeCorrect ?? 0,
      totalWrong: report?.totals?.lifetimeWrong ?? 0,
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

  if (screen === 'landing') {
    return <Landing onGoLogin={goLogin} onGoSignup={goSignup} />;
  }

  if (screen === 'login') {
    return (
      <div dir="rtl" className="sd-page">
        <div className="sd-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', padding: '0 24px' }}>
            <Login
              initialMode={loginMode}
              onRequestCode={requestOtp}
              onVerifyCode={verifyOtp}
              onSignup={signupStudent}
              error={loginError}
              busy={loginBusy}
            />
            <button
              onClick={goLanding}
              style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px', alignSelf: 'center' }}
            >
              ← العودة للصفحة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'goal') {
    return (
      <div dir="rtl" className="sd-page">
        <div className="sd-shell sd-screen sd-screen-tight" style={{ justifyContent: 'center' }}>
          <GoalSetup tests={tests} onSubmit={handleGoalSubmit} busy={goalBusy} />
        </div>
      </div>
    );
  }

  // Home / Dashboard / Profile keep the bottom tab bar — the focused/immersive
  // screens (Question, Explanations, Complete, Pricing, WeeklyReport) don't,
  // matching Student.dc.html's bottomNavStyle only appearing on those three.
  const tabScreens = ['home', 'performance', 'profile'];
  const showBottomNav = tabScreens.includes(screen);

  return (
    <div dir="rtl" className="sd-page">
      <div className="sd-shell">
        <div className={`sd-screen${showBottomNav ? '' : ' sd-screen-tight'}`}>
          {wathbError && (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{wathbError}</p>
          )}
          {screen === 'home' && <Home vm={homeVm} student={student} goTestPicker={startWathb} />}
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
          {screen === 'weeklyReport' && <WeeklyReport report={report} onOpenPerformance={goPerformance} />}
          {screen === 'pricing' && (
            <Pricing packages={packages} onSubscribe={subscribeToPackage} blockedMessage={pricingMessage} onBack={goHome} />
          )}
          {screen === 'profile' && (
            <Profile
              student={student}
              subscription={subscription}
              onManageSubscription={() => goPricing()}
              supervisors={supervisors}
              onInvite={inviteSupervisor}
              onRevoke={revokeSupervisor}
              inviteBusy={inviteBusy}
              inviteError={inviteError}
            />
          )}

          {showBottomNav && (
            <div className="sd-bottom-nav">
              <button onClick={goHome} className={`sd-nav-btn${screen === 'home' ? ' active' : ''}`}>الرئيسية</button>
              <button onClick={goPerformance} className={`sd-nav-btn${screen === 'performance' ? ' active' : ''}`}>لوحة التحكم</button>
              <button onClick={goProfile} className={`sd-nav-btn${screen === 'profile' ? ' active' : ''}`}>ملفي</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
