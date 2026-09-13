import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const centred = {
  minHeight: '100vh', background: 'var(--indigo)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: '24px',
};

const note = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8, textAlign: 'center', maxWidth: '360px', margin: 0 };

/**
 * SCH-006 — the school app shell.
 *
 * Three states, in order: no session → Login; session but no school list yet →
 * loading; session with schools → Dashboard. A session whose school list comes
 * back empty is a real case rather than an error — access was revoked while the
 * token was still valid — so it gets its own screen instead of an exception.
 */
export default function App() {
  const [token, setTokenState] = useState(() => getToken());
  const [schools, setSchools] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setSchools(null);
    setSchoolId(null);
    setError(null);
  }, []);

  // Load the school list whenever we hold a session — on boot from a stored
  // token as well as straight after a login, so both paths go through the same
  // code and a stale token is discovered immediately rather than on first read.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setBusy(true);
    api.mySchools()
      .then((rows) => {
        if (cancelled) return;
        setSchools(rows);
        setSchoolId((current) => (rows.some((r) => r.schoolId === current) ? current : rows[0]?.schoolId ?? null));
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        // 401 means the stored token expired or was revoked; anything else is
        // worth showing rather than silently bouncing to the login screen.
        if (/401|unauthor/i.test(e.message)) signOut();
        else setError(e.message);
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [token, signOut]);

  const requestCode = async (mobile) => {
    setBusy(true);
    setError(null);
    try {
      return await api.requestCode(mobile);
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (mobile, code) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyCode(mobile, code);
      setToken(res.token);
      setTokenState(res.token);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return <Login onRequestCode={requestCode} onVerifyCode={verifyCode} error={error} busy={busy} />;
  }

  if (!schools) {
    return (
      <div dir="rtl" style={centred}>
        <p style={note}>{error ?? 'جارٍ تحميل بيانات مدرستك…'}</p>
      </div>
    );
  }

  const school = schools.find((s) => s.schoolId === schoolId);
  if (!school) {
    return (
      <div dir="rtl" style={centred}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
          <p style={note}>
            حسابك غير مرتبط بأي مدرسة حاليًا. إن كنت تتوقّع الوصول إلى لوحة مدرسة، تواصل مع فريق وثب لتفعيل الارتباط.
          </p>
          <button
            onClick={signOut}
            style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          >
            خروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      api={api}
      school={school}
      schools={schools}
      onSwitchSchool={setSchoolId}
      onLogout={signOut}
    />
  );
}
