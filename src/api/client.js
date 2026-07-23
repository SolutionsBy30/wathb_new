const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_session_token';

export function getToken() {
  return localStorage.getItem(SESSION_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
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
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {
      /* body wasn't JSON */
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
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
  me: () => request('/students/me'),
  setGoal: (dto) => request('/students/me/goal', { method: 'PATCH', body: dto }),
  setNotificationPrefs: (dto) => request('/students/me/notification-prefs', { method: 'PATCH', body: dto }),

  today: () => request('/wathb/today'),
  answer: (wathbId, position, selectedKey) =>
    request(`/wathb/${wathbId}/answer`, { method: 'POST', body: { position, selectedKey } }),
  complete: (wathbId) => request(`/wathb/${wathbId}/complete`, { method: 'POST' }),

  report: (studentId) => request(`/report/student/${studentId}`),

  listMySupervisors: () => request('/students/me/supervisors'),
  inviteSupervisor: (mobile, name, type) =>
    request('/students/me/supervisors/invite', { method: 'POST', body: { mobile, name, type } }),
  revokeSupervisor: (id) => request(`/students/me/supervisors/${id}/revoke`, { method: 'POST' }),

  listPackages: () => request('/packages', { auth: false }),
  startCheckout: (packageId) => request('/checkout/start', { method: 'POST', body: { packageId } }),
  mySubscription: () => request('/checkout/me'),
};
