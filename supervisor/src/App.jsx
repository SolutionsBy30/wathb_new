import { useEffect, useState } from 'react';
import { api, getToken, setToken, decodeSession } from './api/client';
import Login from './pages/Login';
import LinkExpired from './pages/LinkExpired';
import AcceptInvite from './pages/AcceptInvite';
import Dashboard from './pages/Dashboard';
import StudentReport from './pages/StudentReport';
import Preferences from './pages/Preferences';
import PendingInvites from './pages/PendingInvites';

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);

  const loadDashboard = async () => {
    setDashboard(await api.dashboard());
    setScreen('dashboard');
  };

  const loadPendingInvites = async () => {
    setPendingInvites(await api.listPendingInvites());
  };

  const openPendingInvites = async () => {
    await loadPendingInvites();
    setScreen('invites');
  };

  const bootstrap = async () => {
    // A tap on a WhatsApp link (invite or weekly report) lands here as
    // #magic=<token> — exchange it for a scoped session, same as the
    // student app, then drop it from the URL (spec §7.1).
    const hashMatch = window.location.hash.match(/^#magic=(.+)$/);
    let magicLinkFailed = false;
    if (hashMatch) {
      try {
        const { token: sessionToken } = await api.exchangeMagicLink(hashMatch[1]);
        setToken(sessionToken);
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        setToken(null);
        magicLinkFailed = true;
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    const token = getToken();
    // STU-030 — a friendly reason for landing on login, not a silent drop.
    if (!token) return setScreen(magicLinkFailed ? 'linkExpired' : 'login');
    const session = decodeSession(token);
    if (session?.purpose === 'link_invite' && session.targetId) {
      setScreen('accept');
      return;
    }
    try {
      await loadDashboard();
      loadPendingInvites().catch(() => {}); // badge count only — non-fatal if it fails
    } catch {
      setToken(null);
      setScreen('login');
    }
  };

  useEffect(() => { bootstrap(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

  const signupSupervisor = async (mobile, name, type, whatsappOptIn) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      return await api.signupSupervisor(mobile, name, type, whatsappOptIn);
    } catch (e) {
      setLoginError(e.message || 'تعذّر إنشاء الحساب');
      return null;
    } finally {
      setLoginBusy(false);
    }
  };

  const handleAccept = async () => {
    setAcceptBusy(true);
    setAcceptError(null);
    try {
      const session = decodeSession(getToken());
      await api.acceptInvite(session.targetId);
      await loadDashboard();
    } catch (e) {
      setAcceptError(e.message);
    } finally {
      setAcceptBusy(false);
    }
  };

  const openStudent = async (studentId) => {
    setReport(await api.report(studentId));
    setScreen('report');
  };

  if (screen === 'loading') {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</span>
      </div>
    );
  }

  if (screen === 'linkExpired') return <LinkExpired onGoLogin={() => setScreen('login')} />;
  if (screen === 'login') return <Login onRequestCode={requestOtp} onVerifyCode={verifyOtp} onSignup={signupSupervisor} error={loginError} busy={loginBusy} />;
  if (screen === 'accept') return <AcceptInvite onAccept={handleAccept} busy={acceptBusy} error={acceptError} />;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '17px', color: 'var(--sand)' }}>وثب · متابعة</span>
        <button
          onClick={() => setScreen('dashboard')}
          style={{ border: 'none', background: 'transparent', color: screen === 'dashboard' ? 'var(--sand)' : 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          لوحتي
        </button>
        <button
          onClick={openPendingInvites}
          style={{ border: 'none', background: 'transparent', color: screen === 'invites' ? 'var(--sand)' : 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          الدعوات المعلّقة
          {pendingInvites.length > 0 && (
            <span style={{ background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: '999px', fontSize: '10px', fontFamily: 'var(--font-latin)', padding: '1px 6px' }}>
              {pendingInvites.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setScreen('preferences')}
          style={{ border: 'none', background: 'transparent', color: screen === 'preferences' ? 'var(--sand)' : 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          إعدادات الإشعارات
        </button>
        <button
          onClick={() => { setToken(null); setScreen('login'); }}
          style={{ marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          خروج
        </button>
      </header>
      <main style={{ padding: '24px', maxWidth: '760px', margin: '0 auto' }}>
        {screen === 'dashboard' && <Dashboard data={dashboard} onOpenStudent={openStudent} />}
        {screen === 'report' && <StudentReport report={report} onBack={() => setScreen('dashboard')} />}
        {screen === 'preferences' && <Preferences />}
        {screen === 'invites' && (
          <PendingInvites
            invites={pendingInvites}
            onAccept={async (id) => { await api.acceptInvite(id); setDashboard(await api.dashboard()); }}
            onReject={api.rejectInvite}
            onRefresh={loadPendingInvites}
          />
        )}
      </main>
    </div>
  );
}
