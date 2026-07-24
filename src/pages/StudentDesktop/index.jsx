import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './layout.css';
import { api, getToken, setToken, decodeSession } from '../../api/client';
import Landing from '../Landing';
import Login from './screens/Login';
import LinkExpired from './screens/LinkExpired';
import GoalSetup from './screens/GoalSetup';
import NotificationSlotSetup from './screens/NotificationSlotSetup';
import InviteSupervisorPrompt from './screens/InviteSupervisorPrompt';
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
  const [timeTotal, setTimeTotal] = useState(0);
  // NFR-014 — the countdown must not be the only signal; a screen-reader
  // announcement fires once at 50% and once at 25% of the time remaining.
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const announcedThresholdsRef = useRef(new Set());
  const [wathbError, setWathbError] = useState(null);
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false);
  const [completeResult, setCompleteResult] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [onboardingInviteBusy, setOnboardingInviteBusy] = useState(false);
  const [onboardingInviteError, setOnboardingInviteError] = useState(null);
  const [notifSlotBusy, setNotifSlotBusy] = useState(false);
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
    let magicLinkFailed = false;
    if (hashMatch) {
      try {
        const { token: sessionToken } = await api.exchangeMagicLink(hashMatch[1]);
        setToken(sessionToken);
        magicPurpose = decodeSession(sessionToken)?.purpose ?? null;
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        setToken(null);
        magicLinkFailed = true;
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    if (!getToken()) {
      // STU-030 — a tapped link that's expired, already used, or revoked
      // gets its own friendly screen with a way back in, not a silent drop
      // onto the generic landing page.
      setScreen(magicLinkFailed ? 'linkExpired' : 'landing');
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

  const signupStudent = async (mobile, name, whatsappOptIn) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      return await api.signupStudent(mobile, name, whatsappOptIn);
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
      // ONB-012 — hidden entirely (not just locked) for free-package
      // students, who receive no daily WhatsApp notification at all
      // (Package.dailyNotificationEnabled), straight on to the ONB-013
      // invite prompt. Neither screen ever reappears once passed, since
      // targetTestId being set is what routes bootstrap() straight to home.
      setScreen(subscription?.package?.dailyNotificationEnabled === false ? 'supervisorInvite' : 'notifSlot');
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setGoalBusy(false);
    }
  };

  const submitNotifSlot = async (dto) => {
    setNotifSlotBusy(true);
    try {
      await api.setNotificationPrefs(dto);
    } finally {
      setNotifSlotBusy(false);
      setScreen('supervisorInvite');
    }
  };

  const submitOnboardingInvite = async (mobile, name, type) => {
    setOnboardingInviteBusy(true);
    setOnboardingInviteError(null);
    try {
      await api.inviteSupervisor(mobile, name, type);
      setScreen('home');
    } catch (e) {
      setOnboardingInviteError(e.message);
    } finally {
      setOnboardingInviteBusy(false);
    }
  };

  const skipOnboardingInvite = () => {
    setOnboardingInviteError(null);
    setScreen('home');
  };

  const startTimerFor = useCallback((seconds, onExpire) => {
    stopTimer();
    setTimeLeft(seconds);
    setTimeTotal(seconds);
    announcedThresholdsRef.current = new Set();
    setTimerAnnouncement('');
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

  // NFR-014 — fires once per threshold per question, keyed off the actual
  // countdown value rather than a separate timer, so it can never drift
  // out of sync with what's on screen.
  useEffect(() => {
    if (!timeTotal) return;
    const half = Math.round(timeTotal / 2);
    const quarter = Math.round(timeTotal / 4);
    if (timeLeft === half && !announcedThresholdsRef.current.has('half')) {
      announcedThresholdsRef.current.add('half');
      setTimerAnnouncement('متبقٍ نصف الوقت');
    } else if (timeLeft === quarter && !announcedThresholdsRef.current.has('quarter')) {
      announcedThresholdsRef.current.add('quarter');
      setTimerAnnouncement('متبقٍ ربع الوقت');
    }
  }, [timeLeft, timeTotal]);

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
      compositeIndex: report?.compositeIndex ?? null,
      compositeIndexDelta: report?.compositeIndexDelta ?? null,
      restricted: report?.restricted ?? false,
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
      // ADM-012 — content direction follows the test's configured language;
      // only the question stem/options flip, not the surrounding app chrome
      // (spec: "Arabic RTL is the default layout direction, not a theme").
      contentDir: wathb.contentLanguage === 'en' ? 'ltr' : 'rtl',
    };
  }, [wathb, qIndex, timeLeft, selectedIndex]);

  const completeVm = useMemo(() => {
    if (!completeResult) return null;
    // `report` here is still the *pre-session* snapshot — nothing reloads it
    // between starting a Wathb and reaching this screen — so it doubles as
    // the "before" baseline for the per-label comparison below.
    const beforeByLabel = new Map();
    for (const area of report?.accuracyByArea ?? []) {
      for (const l of area.labels ?? []) beforeByLabel.set(l.labelId, l);
    }
    const sessionByLabel = new Map();
    for (const q of completeResult.questions) {
      const cur = sessionByLabel.get(q.labelId) ?? { labelId: q.labelId, name: q.labelNameAr, total: 0, correct: 0 };
      cur.total += 1;
      if (q.isCorrect) cur.correct += 1;
      sessionByLabel.set(q.labelId, cur);
    }
    const labelRows = [...sessionByLabel.values()].map((s) => {
      const before = beforeByLabel.get(s.labelId);
      const nowPct = Math.round((s.correct / s.total) * 100);
      const hasBaseline = before && !before.collecting;
      const deltaPts = hasBaseline ? nowPct - Math.round(before.accuracy * 100) : null;
      return {
        labelId: s.labelId,
        name: s.name,
        nowPct,
        deltaText: deltaPts === null ? 'أول بيانات' : deltaPts === 0 ? 'بلا تغيير' : deltaPts > 0 ? `+${deltaPts}%` : `${deltaPts}%`,
        deltaColor: deltaPts === null ? 'var(--mist)' : deltaPts >= 0 ? 'var(--teal-ink)' : 'var(--coral)',
      };
    });
    const streakCount = completeResult.streak;
    return {
      activeTestName: wathb?.bundleType === 'placement' ? 'وثبة تحديد المستوى' : 'وثبة اليوم',
      completeHeadline: completeResult.correctCount === completeResult.total ? 'إجابات كاملة. وثبة نظيفة.' : 'وثبة مكتملة.',
      sessionCorrect: completeResult.correctCount, qTotal: completeResult.total,
      streakCount,
      streakDays: Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(streakCount, 7)),
      labelRows,
    };
  }, [completeResult, wathb, report]);

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

  if (screen === 'linkExpired') {
    return (
      <div dir="rtl" className="sd-page">
        <div className="sd-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
          <LinkExpired onGoLogin={goLogin} onGoLanding={goLanding} />
        </div>
      </div>
    );
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

  if (screen === 'notifSlot') {
    return (
      <div dir="rtl" className="sd-page">
        <div className="sd-shell sd-screen sd-screen-tight" style={{ justifyContent: 'center' }}>
          <NotificationSlotSetup
            initialStartHour={student?.notifSlotStartHour}
            initialEndHour={student?.notifSlotEndHour}
            initialSkipDays={student?.skipDays}
            onSubmit={submitNotifSlot}
            busy={notifSlotBusy}
          />
        </div>
      </div>
    );
  }

  if (screen === 'supervisorInvite') {
    return (
      <div dir="rtl" className="sd-page">
        <div className="sd-shell sd-screen sd-screen-tight" style={{ justifyContent: 'center' }}>
          <InviteSupervisorPrompt
            onInvite={submitOnboardingInvite}
            onSkip={skipOnboardingInvite}
            busy={onboardingInviteBusy}
            error={onboardingInviteError}
            locked={subscription?.package?.supervisorLinkingAllowed === false}
            onManageSubscription={() => goPricing()}
          />
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
      {/* NFR-014 — the timer's 50%/25% announcement; visually hidden, always mounted so it's never missed by a screen reader. */}
      <div className="sd-sr-only" role="status" aria-live="assertive">{timerAnnouncement}</div>
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
          {screen === 'performance' && <Performance report={report} onUpgrade={() => goPricing()} />}
          {screen === 'weeklyReport' && <WeeklyReport report={report} onOpenPerformance={goPerformance} />}
          {screen === 'pricing' && (
            <Pricing packages={packages} onSubscribe={subscribeToPackage} blockedMessage={pricingMessage} onBack={goHome} />
          )}
          {screen === 'profile' && (
            <Profile
              student={student}
              subscription={subscription}
              onManageSubscription={() => goPricing()}
              onSubscriptionChanged={loadSubscription}
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
