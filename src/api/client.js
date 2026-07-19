const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_session_token';

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
    } catch {
      /* body wasn't JSON */
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Dev-only stand-in for the WhatsApp magic-link tap — see api/src/auth/auth.controller.ts.
  devRequestLink: (mobile, subjectType = 'student') =>
    request('/auth/dev/request-link', { method: 'POST', body: { mobile, subjectType }, auth: false }),
  exchangeMagicLink: (token) => request(`/auth/magic/${token}`, { method: 'POST', auth: false }),

  listTests: () => request('/tests', { auth: false }),
  me: () => request('/students/me'),
  setGoal: (dto) => request('/students/me/goal', { method: 'PATCH', body: dto }),

  today: () => request('/wathb/today'),
  answer: (wathbId, position, selectedKey) =>
    request(`/wathb/${wathbId}/answer`, { method: 'POST', body: { position, selectedKey } }),
  complete: (wathbId) => request(`/wathb/${wathbId}/complete`, { method: 'POST' }),

  report: (studentId) => request(`/report/student/${studentId}`),

  listMySupervisors: () => request('/students/me/supervisors'),
  inviteSupervisor: (mobile, name, type) =>
    request('/students/me/supervisors/invite', { method: 'POST', body: { mobile, name, type } }),
  revokeSupervisor: (id) => request(`/students/me/supervisors/${id}/revoke`, { method: 'POST' }),
};
