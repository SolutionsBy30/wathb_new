const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_session_token';

export function getToken() {
  return localStorage.getItem(SESSION_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

/**
 * ADM-032 — question artwork is stored as a root-relative `/api/uploads/...`
 * path so it survives a domain change. In production the app and the API
 * share an origin and that path resolves on its own; in dev the app is on
 * :5173 and the API on :4000, so resolve against the API origin. An absolute
 * URL (an author pointing at their own host) is passed through untouched.
 */
export function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
}

export function decodeSession(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
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
    let code = null;
    try {
      const err = await res.json();
      message = err.message || message;
      // STU-031 — the API tags refusals it wants the UI to react to
      // differently ('no_test_enabled' vs 'no_subscription'). Carried on the
      // Error so callers branch on a stable code instead of substring-matching
      // a human-readable message that translation would silently break.
      code = err.code ?? null;
    } catch {
      /* body wasn't JSON */
    }
    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    error.status = res.status;
    error.code = code;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Login page — mobile + OTP (spec §9.3). devCode is only present when the
  // API has ALLOW_DEV_LOGIN=true, so local dev doesn't need a real WhatsApp
  // number to receive the code.
  requestOtp: (mobile) => request('/auth/otp/request', { method: 'POST', body: { mobile, subjectType: 'student' }, auth: false }),
  verifyOtp: (mobile, code) => request('/auth/otp/verify', { method: 'POST', body: { mobile, subjectType: 'student', code }, auth: false }),
  signupStudent: (mobile, name, whatsappOptIn) => request('/auth/signup/student', { method: 'POST', body: { mobile, name, whatsappOptIn }, auth: false }),

  // Exchanging the link a real WhatsApp Wathb notification delivers (see
  // api/src/notifications/notifications.service.ts) — not part of login.
  exchangeMagicLink: (token) => request(`/auth/magic/${token}`, { method: 'POST', auth: false }),

  listTests: () => request('/tests', { auth: false }),
  dailyTip: () => request('/daily-tip'),
  me: () => request('/students/me'),
  setGoal: (dto) => request('/students/me/goal', { method: 'PATCH', body: dto }),
  setNotificationPrefs: (dto) => request('/students/me/notification-prefs', { method: 'PATCH', body: dto }),
  // NOT-012 — email as a second notification channel.
  setEmailPrefs: (dto) => request('/students/me/email-prefs', { method: 'PATCH', body: dto }),

  today: (testId) => request(`/wathb/today${testId ? `?testId=${encodeURIComponent(testId)}` : ''}`),
  myTests: () => request('/students/me/tests'),
  updateMyTest: (testId, dto) => request(`/students/me/tests/${testId}`, { method: 'PATCH', body: dto }),
  myLeaps: () => request('/students/me/leaps'),
  answer: (wathbId, position, selectedKey) =>
    request(`/wathb/${wathbId}/answer`, { method: 'POST', body: { position, selectedKey } }),
  complete: (wathbId) => request(`/wathb/${wathbId}/complete`, { method: 'POST' }),
  rateExplanation: (answerId, rating) => request(`/wathb/answers/${answerId}/rate-explanation`, { method: 'POST', body: { rating } }),
  reportProblem: (answerId, note) => request(`/wathb/answers/${answerId}/report-problem`, { method: 'POST', body: { note } }),

  report: (studentId) => request(`/report/student/${studentId}`),

  listMySupervisors: () => request('/students/me/supervisors'),
  inviteSupervisor: (mobile, name, type) =>
    request('/students/me/supervisors/invite', { method: 'POST', body: { mobile, name, type } }),
  revokeSupervisor: (id) => request(`/students/me/supervisors/${id}/revoke`, { method: 'POST' }),

  listPackages: () => request('/packages', { auth: false }),
  startCheckout: (packageId) => request('/checkout/start', { method: 'POST', body: { packageId } }),
  mySubscription: () => request('/checkout/me'),

  // STU-029 — sensitive actions behind step-up auth (fresh OTP). Request the
  // code with the existing requestOtp() against the student's own mobile,
  // then exchange it here for a freshly-elevated session token.
  stepUpVerify: (code) => request('/auth/step-up/verify', { method: 'POST', body: { code } }),
  myPaymentHistory: () => request('/checkout/me/history'),
  cancelSubscription: () => request('/checkout/me/cancel', { method: 'POST' }),
};
