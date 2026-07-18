import { useEffect, useMemo, useRef, useState } from 'react';
import { StreakStrip } from '../../design-system/components/StreakStrip';
import markOnIndigo from '../../design-system/assets/mark-on-indigo.svg';
import {
  TEST_BANKS,
  LS_KEY,
  schoolCohortComposites,
  labelStats,
  trendByTest,
  tipsByLabel,
  recentMistakes,
  wathbHistory,
  heatmapGrid,
  initialState,
} from './data';
import Home from './screens/Home';
import TestPicker from './screens/TestPicker';
import Question from './screens/Question';
import Answered from './screens/Answered';
import Complete from './screens/Complete';
import Dashboard from './screens/Dashboard';
import Profile from './screens/Profile';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function navBtnStyle(active) {
  return {
    textAlign: 'start', border: 'none', cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: active ? 500 : 400,
    color: active ? 'var(--sand)' : 'var(--mist)', background: active ? 'var(--on-indigo-subtle)' : 'transparent',
  };
}

export default function StudentDesktop() {
  const [state, setState] = useState(initialState);
  const timerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved) setState((s) => ({ ...s, ...saved }));
    } catch (e) {}
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function persist(nextState) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        streak: nextState.streak,
        lastCompletedDate: nextState.lastCompletedDate,
        weeklyAnswered: nextState.weeklyAnswered,
        perf: nextState.perf,
      }));
    } catch (e) {}
  }

  function computeAnswerState(s, chosenIndex) {
    const q = TEST_BANKS[s.activeTestId].questions[s.qIndex];
    const isCorrect = chosenIndex === q.correctIndex;
    return {
      screen: 'answered',
      answerStatus: isCorrect ? 'correct' : 'wrong',
      selectedIndex: chosenIndex,
      sessionCorrect: s.sessionCorrect + (isCorrect ? 1 : 0),
    };
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setState((s) => {
        if (s.timeLeft <= 1) {
          clearInterval(timerRef.current);
          return { ...s, ...computeAnswerState(s, null) };
        }
        return { ...s, timeLeft: s.timeLeft - 1 };
      });
    }, 1000);
  }

  const goTestPicker = () => setState((s) => ({ ...s, screen: 'testPicker' }));
  const goDashboard = () => setState((s) => ({ ...s, screen: 'dashboard', dashboardTestId: null }));
  const openDashboardTest = (id) => setState((s) => ({ ...s, dashboardTestId: id }));
  const backToDashboardList = () => setState((s) => ({ ...s, dashboardTestId: null, selectedWathbId: null }));
  const openWathb = (id) => setState((s) => ({ ...s, selectedWathbId: id }));
  const goHomeTab = () => setState((s) => ({ ...s, screen: 'home' }));
  const goProfile = () => setState((s) => ({ ...s, screen: 'profile' }));
  const backHome = () => setState((s) => ({ ...s, screen: 'home' }));

  const setInviteName = (e) => { const v = e.target.value; setState((s) => ({ ...s, inviteName: v, inviteSent: false })); };
  const setInvitePhone = (e) => { const v = e.target.value; setState((s) => ({ ...s, invitePhone: v, inviteSent: false })); };
  const sendInvite = () => setState((s) => (s.inviteName.trim() && s.invitePhone.trim() ? { ...s, inviteSent: true } : s));
  const setDailyWathbTime = (e) => { const v = e.target.value; setState((s) => ({ ...s, dailyWathbTime: v, settingsSaved: false })); };
  const setWeeklyReportDay = (day) => setState((s) => ({ ...s, weeklyReportDay: day, settingsSaved: false }));
  const setWeeklyReportTime = (e) => { const v = e.target.value; setState((s) => ({ ...s, weeklyReportTime: v, settingsSaved: false })); };
  const saveSettings = () => setState((s) => ({ ...s, settingsSaved: true }));
  const renewSubscription = () => setState((s) => ({ ...s, renewed: true }));
  const revokeAccess = (id) => setState((s) => ({ ...s, linkedSupervisors: s.linkedSupervisors.filter((sp) => sp.id !== id) }));
  const toggleTestEnabled = (id) => setState((s) => ({ ...s, enabledTests: { ...s.enabledTests, [id]: !s.enabledTests[id] } }));

  const selectTest = (testId) => {
    const q0 = TEST_BANKS[testId].questions[0];
    setState((s) => ({ ...s, screen: 'question', activeTestId: testId, qIndex: 0, selectedIndex: null, sessionCorrect: 0, timeLeft: q0.timerS }));
    startTimer();
  };

  const selectOption = (i) => setState((s) => ({ ...s, selectedIndex: i }));

  const confirmAnswer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState((s) => ({ ...s, ...computeAnswerState(s, s.selectedIndex) }));
  };

  const nextQuestion = () => {
    setState((s) => {
      const bank = TEST_BANKS[s.activeTestId];
      const isLast = s.qIndex >= bank.questions.length - 1;
      if (isLast) {
        const newStreak = s.lastCompletedDate === todayKey() ? s.streak : s.streak + 1;
        const prevPerf = s.perf[s.activeTestId];
        const newTotal = prevPerf.totalAnswered + bank.questions.length;
        const newCorrect = prevPerf.correct + s.sessionCorrect;
        const newWrong = newTotal - newCorrect;
        const updatedPerf = { ...s.perf, [s.activeTestId]: { ...prevPerf, totalAnswered: newTotal, correct: newCorrect, wrong: newWrong, accuracy: Math.round((newCorrect / newTotal) * 100) } };
        const next = { ...s, screen: 'complete', streak: newStreak, lastCompletedDate: todayKey(), weeklyAnswered: Math.min(s.weeklyAnswered + bank.questions.length, 35), perf: updatedPerf };
        persist(next);
        return next;
      }
      const nextIdx = s.qIndex + 1;
      return { ...s, screen: 'question', qIndex: nextIdx, selectedIndex: null, answerStatus: null, timeLeft: bank.questions[nextIdx].timerS };
    });
  };
  // startTimer reads the freshest state via its own setState updater, so it's safe
  // to kick off right after the state update above rather than inside it.
  function goToNextQuestion() {
    const wasLast = TEST_BANKS[state.activeTestId].questions.length - 1 <= state.qIndex;
    nextQuestion();
    if (!wasLast) startTimer();
  }

  const resetProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    setState((s) => ({
      ...s,
      screen: 'home', streak: 23, lastCompletedDate: null, weeklyAnswered: 32, qIndex: 0, selectedIndex: null, sessionCorrect: 0,
      perf: { qudurat: { composite: 71, accuracy: 74, totalAnswered: 253, correct: 182, wrong: 71 }, tahsili: { composite: 63, accuracy: 66, totalAnswered: 96, correct: 52, wrong: 44 } },
    }));
  };

  const vm = useMemo(() => {
    const s = state;
    const bank = TEST_BANKS[s.activeTestId];
    const q = bank.questions[s.qIndex];
    const alreadyDoneToday = s.lastCompletedDate === todayKey();
    const streakDays = Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(s.streak, 7));
    const weeklyPct = Math.round((s.weeklyAnswered / 35) * 100);
    const progressDots = bank.questions.map((_, i) => ({
      flex: 1, height: '4px', borderRadius: '2px',
      background: i < s.qIndex ? 'var(--lime)' : i === s.qIndex ? 'var(--sand)' : 'var(--on-indigo-subtle)',
    }));
    const correctOptionText = q ? q.options[q.correctIndex] : '';
    const totalAnswered = s.perf.qudurat.totalAnswered + s.perf.tahsili.totalAnswered;
    const totalCorrect = s.perf.qudurat.correct + s.perf.tahsili.correct;
    const totalWrong = s.perf.qudurat.wrong + s.perf.tahsili.wrong;
    const weakestTest = s.perf.qudurat.accuracy <= s.perf.tahsili.accuracy ? 'قدرات' : 'تحصيلي';
    const weakestAcc = Math.min(s.perf.qudurat.accuracy, s.perf.tahsili.accuracy);

    const schoolRankText = (() => {
      const myComposite = s.perf.qudurat.composite;
      const all = [...schoolCohortComposites, myComposite].sort((a, b) => b - a);
      const rank = all.indexOf(myComposite) + 1;
      return `${rank} من ${all.length} طالباً في مدرستك`;
    })();

    const dailyTip = (() => {
      const weakIds = Object.keys(labelStats).filter((id) => labelStats[id].acc < 60);
      const pool = weakIds.length ? weakIds : Object.keys(labelStats);
      const dayIndex = Math.floor(Date.now() / 86400000);
      const id = pool[dayIndex % pool.length];
      return { labelName: labelStats[id].name, text: tipsByLabel[id] || '' };
    })();

    const wathbHistoryRows = wathbHistory.map((w) => {
      const acc = Math.round((w.correct / w.total) * 100);
      return {
        id: w.id, dateLabel: w.dateLabel, testName: w.testId === 'qudurat' ? 'قدرات' : 'تحصيلي',
        scoreText: `${w.correct}/${w.total}`, accPct: acc,
        accStyle: { fontFamily: 'var(--font-latin)', fontSize: '12px', color: acc >= 60 ? 'var(--teal-ink)' : 'var(--coral)' },
        open: () => openWathb(w.id),
      };
    });

    const wathbDetail = (() => {
      const w = wathbHistory.find((x) => x.id === s.selectedWathbId);
      if (!w) return null;
      const acc = Math.round((w.correct / w.total) * 100);
      const overTime = w.avgTimeS > w.targetS;
      const bankQuestions = TEST_BANKS[w.testId].questions;
      const wrongCount = w.total - w.correct;
      const questionReviews = bankQuestions.slice(0, w.total).map((qq, i) => {
        const isWrong = i < wrongCount;
        const wrongIndex = qq.options.findIndex((_, oi) => oi !== qq.correctIndex);
        const selectedIndex = isWrong ? wrongIndex : qq.correctIndex;
        return {
          n: i + 1, stem: qq.stem, selectedText: qq.options[selectedIndex], correctText: qq.options[qq.correctIndex],
          isCorrect: !isWrong, explanation: qq.explanation, showCorrectText: isWrong,
          answerLineStyle: { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: isWrong ? 'var(--coral)' : 'var(--teal-ink)' },
        };
      });
      return {
        dateLabel: w.dateLabel, testName: w.testId === 'qudurat' ? 'قدرات' : 'تحصيلي',
        correct: w.correct, total: w.total, wrong: w.total - w.correct, accPct: acc,
        avgTimeS: w.avgTimeS, targetS: w.targetS,
        speedStyle: { fontFamily: 'var(--font-latin)', color: overTime ? 'var(--coral)' : 'var(--teal-ink)' },
        labels: w.labels, questionReviews,
      };
    })();

    const labelStatRows = Object.keys(labelStats)
      .filter((id) => !s.dashboardTestId || (s.dashboardTestId === 'qudurat' ? labelStats[id].testName === 'قدرات' : labelStats[id].testName === 'تحصيلي'))
      .map((id) => {
        const l = labelStats[id];
        const insufficient = l.n < 20;
        const tone = l.acc >= 60 ? 'teal' : 'coral';
        const overTime = l.meanTimeS > l.targetS;
        return {
          id, name: l.name, testName: l.testName,
          barVal: insufficient ? 0 : l.acc,
          statText: insufficient ? `قيد الجمع — ${l.n} من 20` : `${l.acc}%`,
          tone, pctStyle: { fontFamily: 'var(--font-latin)', fontSize: '12px', color: insufficient ? 'var(--mist)' : (tone === 'teal' ? 'var(--teal-ink)' : 'var(--coral)') },
          speedText: `${l.meanTimeS}ث / هدف ${l.targetS}ث`,
          speedStyle: { fontFamily: 'var(--font-latin)', fontSize: '12px', color: overTime ? 'var(--coral)' : 'var(--teal-ink)' },
        };
      });

    const trendBars = (() => {
      const trend = trendByTest[s.dashboardTestId || 'qudurat'];
      const max = Math.max(...trend, 1);
      const min = Math.min(...trend, 0);
      return trend.map((v, i) => ({
        v, style: {
          flex: 1, height: (12 + Math.round(((v - min) / Math.max(1, max - min)) * 60)) + 'px',
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          background: i === trend.length - 1 ? 'var(--lime)' : 'var(--on-indigo-line)',
        },
      }));
    })();

    return {
      showHome: s.screen === 'home', showTestPicker: s.screen === 'testPicker', showQuestion: s.screen === 'question',
      showAnswered: s.screen === 'answered', showComplete: s.screen === 'complete', showDashboard: s.screen === 'dashboard',
      showProfile: s.screen === 'profile',
      navHomeStyle: navBtnStyle(s.screen === 'home'), navDashStyle: navBtnStyle(s.screen === 'dashboard'), navProfileStyle: navBtnStyle(s.screen === 'profile'),
      studentName: 'سارة القحطاني', studentGrade: 'ثالث ثانوي', studentTrack: 'علمي', studentSchool: 'ثانوية الرياض النموذجية',
      schoolRankText,
      homeHeadline: alreadyDoneToday ? 'راح تكون هنا غداً وثبة جديدة.' : 'اختر وثبة اليوم.',
      streakCount: s.streak, streakDays,
      weeklyAnswered: s.weeklyAnswered, weeklyTarget: 35, weeklyPct,
      totalAnswered, totalCorrect, totalWrong,
      alreadyDoneToday,
      todayScoreText: `أجبت ${s.sessionCorrect} من ${bank.questions.length} إجابة صحيحة.`,
      startButtonLabel: alreadyDoneToday ? 'ابدأ وثبة إضافية' : 'ابدأ الوثبة',
      testChoices: Object.keys(TEST_BANKS).filter((id) => s.enabledTests[id]).map((id) => ({
        id, name: TEST_BANKS[id].name, qCount: TEST_BANKS[id].questions.length, composite: s.perf[id].composite,
        select: () => selectTest(id),
      })),
      testEnableRows: Object.keys(TEST_BANKS).map((id) => ({
        id, name: TEST_BANKS[id].name, enabled: s.enabledTests[id],
        toggle: () => toggleTestEnabled(id),
        toggleStyle: { width: '44px', height: '26px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', background: s.enabledTests[id] ? 'var(--lime)' : 'var(--indigo)', padding: '3px' },
        knobStyle: { width: '18px', height: '18px', borderRadius: '999px', background: s.enabledTests[id] ? 'var(--lime-ink)' : 'var(--mist)', transform: s.enabledTests[id] ? 'translateX(-18px)' : 'translateX(0)', transition: 'transform 0.16s' },
      })),
      activeTestName: bank.name,
      qNumber: s.qIndex + 1, qTotal: bank.questions.length,
      timeLeft: s.timeLeft, timerStyle: { fontFamily: 'var(--font-latin)', fontSize: '13px', color: s.timeLeft <= 10 ? 'var(--coral)' : 'var(--mist)' },
      progressDots,
      currentStem: q ? q.stem : '', currentOptions: q ? q.options : [], currentExplanation: q ? q.explanation : '',
      selectedIndex: s.selectedIndex,
      confirmDisabled: s.selectedIndex === null,
      answerStatus: s.answerStatus, correctOptionText,
      nextButtonLabel: s.qIndex >= bank.questions.length - 1 ? 'إنهاء الوثبة' : 'التالي',
      completeHeadline: s.sessionCorrect === bank.questions.length ? 'إجابات كاملة. وثبة نظيفة.' : 'وثبة مكتملة.',
      sessionCorrect: s.sessionCorrect,
      dailyTip,
      showDashboardList: s.screen === 'dashboard' && !s.dashboardTestId && !s.selectedWathbId,
      showDashboardDetail: s.screen === 'dashboard' && !!s.dashboardTestId,
      showWathbDetail: s.screen === 'dashboard' && !!s.selectedWathbId,
      dashboardTestName: s.dashboardTestId ? TEST_BANKS[s.dashboardTestId].name : '',
      wathbHistoryRows,
      wathbDetail,
      testPerfRows: [
        { id: 'qudurat', name: 'قدرات', ...s.perf.qudurat, tone: s.perf.qudurat.accuracy >= 60 ? 'teal' : 'coral', open: () => openDashboardTest('qudurat') },
        { id: 'tahsili', name: 'تحصيلي', ...s.perf.tahsili, tone: s.perf.tahsili.accuracy >= 60 ? 'teal' : 'coral', open: () => openDashboardTest('tahsili') },
      ].filter((tp) => s.enabledTests[tp.id]),
      analysisAdvice: s.dashboardTestId
        ? `دقتك في ${s.dashboardTestId === 'qudurat' ? 'قدرات' : 'تحصيلي'} حالياً ${s.perf[s.dashboardTestId].accuracy}%. راجع الشرح بعد كل إجابة خاطئة قبل الانتقال للسؤال التالي — هذا يرفع الدقة أسرع من زيادة عدد الأسئلة.`
        : `أضعف مسار حالياً هو ${weakestTest} بدقة ${weakestAcc}%. راجع الشرح بعد كل إجابة خاطئة قبل الانتقال للسؤال التالي — هذا يرفع الدقة أسرع من زيادة عدد الأسئلة.`,
      subPackage: '6 أشهر', subPrice: 149, subRenewsOn: '2026-09-12', subStatus: 'نشط',
      labelStatRows,
      trendBars,
      heatmapCells: heatmapGrid(s.streak).map((week) => week.map((filled) => ({
        width: '13px', height: '13px', borderRadius: '3px', background: filled ? 'var(--lime)' : 'var(--on-indigo-subtle)',
      }))),
      recentMistakeRows: s.dashboardTestId ? recentMistakes.filter((m) => m.testId === s.dashboardTestId) : recentMistakes,
      noWrapStyle: { whiteSpace: 'nowrap' },
      subRenewed: s.renewed,
      inviteName: s.inviteName, invitePhone: s.invitePhone, inviteSent: s.inviteSent,
      dailyWathbTime: s.dailyWathbTime, weeklyReportTime: s.weeklyReportTime, settingsSaved: s.settingsSaved,
      weeklyReportDayOptions: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((d) => ({
        name: d, select: () => setWeeklyReportDay(d),
        style: { border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px',
          background: s.weeklyReportDay === d ? 'var(--lime)' : 'var(--on-indigo-subtle)', color: s.weeklyReportDay === d ? 'var(--lime-ink)' : 'var(--sand)' },
      })),
      linkedSupervisorRows: s.linkedSupervisors.map((sp) => ({ ...sp, revoke: () => revokeAccess(sp.id) })),
      noLinkedSupervisors: s.linkedSupervisors.length === 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1120px', display: 'flex', gap: '32px', padding: '32px' }}>
        <aside style={{ width: '280px', flex: 'none', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={markOnIndigo} alt="وثب" style={{ width: '36px', height: '33px' }} />
            <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب</span>
          </div>

          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{vm.studentName}</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>الصف {vm.studentGrade} · {vm.studentTrack}</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{vm.studentSchool}</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--lime)', marginTop: '4px' }}>ترتيبك: {vm.schoolRankText}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>سلسلة الوثبات</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{vm.streakCount}</span>
            </div>
            <StreakStrip days={vm.streakDays} style={{ width: '100%', height: '26px' }} />
          </div>

          <div style={{ display: 'flex', gap: '16px', background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--mist)' }}>الإجمالي</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{vm.totalAnswered}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--mist)' }}>صحيحة</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--teal-ink)' }}>{vm.totalCorrect}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--mist)' }}>خاطئة</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', fontWeight: 500, color: 'var(--coral)' }}>{vm.totalWrong}</span>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={goHomeTab} style={vm.navHomeStyle}>الرئيسية</button>
            <button onClick={goDashboard} style={vm.navDashStyle}>لوحتي</button>
            <button onClick={goProfile} style={vm.navProfileStyle}>ملفي</button>
          </nav>
        </aside>

        <main style={{ flex: 1, minWidth: 0, background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-lg)', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {vm.showHome && (
            <Home vm={vm} goTestPicker={goTestPicker} resetProgress={resetProgress} />
          )}
          {vm.showTestPicker && (
            <TestPicker vm={vm} backHome={backHome} />
          )}
          {vm.showQuestion && (
            <Question vm={vm} selectOption={selectOption} confirmAnswer={confirmAnswer} />
          )}
          {vm.showAnswered && (
            <Answered vm={vm} nextQuestion={goToNextQuestion} />
          )}
          {vm.showComplete && (
            <Complete vm={vm} goTestPicker={goTestPicker} goDashboard={goDashboard} backHome={backHome} />
          )}
          {vm.showDashboard && (
            <Dashboard vm={vm} backToDashboardList={backToDashboardList} />
          )}
          {vm.showProfile && (
            <Profile
              vm={vm}
              renewSubscription={renewSubscription}
              setInviteName={setInviteName}
              setInvitePhone={setInvitePhone}
              sendInvite={sendInvite}
              setDailyWathbTime={setDailyWathbTime}
              setWeeklyReportTime={setWeeklyReportTime}
              saveSettings={saveSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
}
