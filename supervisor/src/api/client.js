const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_supervisor_session_token';

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
    method, headers,
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
  devRequestLink: (mobile) => request('/auth/dev/request-link', { method: 'POST', body: { mobile, subjectType: 'supervisor' }, auth: false }),
  exchangeMagicLink: (token) => request(`/auth/magic/${token}`, { method: 'POST', auth: false }),

  dashboard: () => request('/supervisors/me/dashboard'),
  acceptInvite: (id) => request(`/supervisors/me/invites/${id}/accept`, { method: 'POST' }),
  report: (studentId) => request(`/report/student/${studentId}`),
};
