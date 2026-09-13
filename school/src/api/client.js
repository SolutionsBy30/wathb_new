const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
// Its own key, not the supervisor app's: the two run on the same origin in
// production and a shared key would let one app pick up the other's session.
const SESSION_KEY = 'wathb_school_session_token';

export function getToken() {
  return localStorage.getItem(SESSION_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch { /* body wasn't JSON */ }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // SCH-004 — school administrators have their own login path. A supervisor
  // session must never reach these screens, so it is not the supervisor's
  // endpoint with a flag.
  requestCode: (mobile) => request('/school/auth/otp/request', { method: 'POST', body: { mobile }, auth: false }),
  verifyCode: (mobile, code) => request('/school/auth/otp/verify', { method: 'POST', body: { mobile, code }, auth: false }),

  mySchools: () => request('/school/me/schools'),
  overview: (schoolId) => request(`/school/${schoolId}/overview`),
  areas: (schoolId) => request(`/school/${schoolId}/areas`),
  attention: (schoolId) => request(`/school/${schoolId}/attention`),
};
