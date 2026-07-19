import { useEffect, useState } from 'react';
import { api, getToken, setToken, decodeSession } from './api/client';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import Dashboard from './pages/Dashboard';
import StudentReport from './pages/StudentReport';

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);

  const loadDashboard = async () => {
    setDashboard(await api.dashboard());
    setScreen('dashboard');
  };

  const bootstrap = async () => {
    const token = getToken();
    if (!token) return setScreen('login');
    const session = decodeSession(token);
    if (session?.purpose === 'link_invite' && session.targetId) {
      setScreen('accept');
      return;
    }
    try {
      await loadDashboard();
    } catch {
      setToken(null);
      setScreen('login');
    }
  };

  useEffect(() => { bootstrap(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleLogin = async (mobile) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const { token: magicToken } = await api.devRequestLink(mobile);
      const { token: sessionToken } = await api.exchangeMagicLink(magicToken);
      setToken(sessionToken);
      await bootstrap();
    } catch (e) {
      setLoginError(e.message || 'تعذّر الدخول');
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

  if (screen === 'login') return <Login onSubmit={handleLogin} error={loginError} busy={loginBusy} />;
  if (screen === 'accept') return <AcceptInvite onAccept={handleAccept} busy={acceptBusy} error={acceptError} />;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '17px', color: 'var(--sand)' }}>وثب · متابعة</span>
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
      </main>
    </div>
  );
}
