const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_admin_session_token';

export function getToken() {
  return localStorage.getItem(SESSION_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
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
  login: (email, password) => request('/auth/admin/login', { method: 'POST', body: { email, password } }),

  listTests: () => request('/tests'),
  tree: (testId) => request(`/tests/${testId}/tree`),
  createTest: (dto) => request('/admin/tests', { method: 'POST', body: dto }),
  createSection: (testId, dto) => request(`/admin/tests/${testId}/sections`, { method: 'POST', body: dto }),
  createArea: (sectionId, dto) => request(`/admin/sections/${sectionId}/areas`, { method: 'POST', body: dto }),
  createLabel: (areaId, dto) => request(`/admin/areas/${areaId}/labels`, { method: 'POST', body: dto }),
  updateLabel: (id, dto) => request(`/admin/labels/${id}`, { method: 'PATCH', body: dto }),
  retireLabel: (id) => request(`/admin/labels/${id}/retire`, { method: 'POST' }),

  listQuestions: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))).toString();
    return request(`/admin/questions${qs ? `?${qs}` : ''}`);
  },
  getQuestion: (id) => request(`/admin/questions/${id}`),
  createQuestion: (dto) => request('/admin/questions', { method: 'POST', body: dto }),
  newVersion: (id, dto) => request(`/admin/questions/${id}/versions`, { method: 'POST', body: dto }),
  setStatus: (id, status) => request(`/admin/questions/${id}/status`, { method: 'PATCH', body: { status } }),
  bulkRetire: (ids) => request('/admin/questions/bulk-retire', { method: 'POST', body: { ids } }),
  findSimilar: (stem) => request(`/admin/questions/similar?stem=${encodeURIComponent(stem)}`),

  importCsv: (file, labelId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('labelId', labelId);
    return request('/admin/questions/import', { method: 'POST', body: form, isForm: true });
  },
  patchImportRow: (jobId, rowIndex, patch) => request(`/admin/questions/import/${jobId}/rows/${rowIndex}`, { method: 'PATCH', body: patch }),
  commitImport: (jobId) => request(`/admin/questions/import/${jobId}/commit`, { method: 'POST' }),

  deliveryLog: () => request('/admin/notifications'),
  planDayAll: () => request('/admin/notifications/plan-day', { method: 'POST', body: {} }),
  sendDueAll: (forDate) => request(`/admin/notifications/send-due${forDate ? `?forDate=${forDate}` : ''}`, { method: 'POST' }),

  listPackages: () => request('/admin/packages'),
  createPackage: (dto) => request('/admin/packages', { method: 'POST', body: dto }),
  updatePackage: (id, dto) => request(`/admin/packages/${id}`, { method: 'PATCH', body: dto }),

  paymentStatus: () => request('/admin/payment-status'),
  searchStudent: (mobile) => request(`/admin/students/search?mobile=${encodeURIComponent(mobile)}`),
  activateWireTransfer: (studentId, packageId) => request('/admin/subscriptions/activate-wire-transfer', { method: 'POST', body: { studentId, packageId } }),

  // ADM-085 — suspension + audit log
  suspendUser: (userId, reason, note) => request(`/admin/users/${userId}/suspend`, { method: 'POST', body: { reason, note } }),
  unsuspendUser: (userId) => request(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),
  auditLog: () => request('/admin/audit-log'),

  // ADM-001/002 — overview KPIs + alerts feed
  overviewKpis: () => request('/admin/overview/kpis'),
  overviewAlerts: () => request('/admin/overview/alerts'),

  // Solution performance (§4.5.2)
  refreshQuestionStats: () => request('/admin/questions/refresh-stats', { method: 'POST' }),

  // Geography & schools (§3.4/§4.8)
  listRegions: () => request('/geography/regions'),
  listCities: (regionId) => request(`/geography/cities${regionId ? `?regionId=${regionId}` : ''}`),
  listSchools: (cityId) => request(`/geography/schools${cityId ? `?cityId=${cityId}` : ''}`),
  createRegion: (dto) => request('/admin/geography/regions', { method: 'POST', body: dto }),
  createCity: (dto) => request('/admin/geography/cities', { method: 'POST', body: dto }),
  createSchool: (dto) => request('/admin/geography/schools', { method: 'POST', body: dto }),
  pendingSchools: () => request('/admin/geography/schools/pending'),
  approveSchool: (id) => request(`/admin/geography/schools/${id}/approve`, { method: 'POST' }),
  rejectSchool: (id) => request(`/admin/geography/schools/${id}`, { method: 'DELETE' }),
  cohortReport: (type, id) => request(`/report/cohort?type=${type}&id=${id}`),

  // Students & supervisors (A9)
  listStudents: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    if (params.schoolId) q.set('schoolId', params.schoolId);
    if (params.cityId) q.set('cityId', params.cityId);
    const qs = q.toString();
    return request(`/admin/students${qs ? `?${qs}` : ''}`);
  },
  setStudentSchool: (studentId, schoolId) => request(`/admin/students/${studentId}/school`, { method: 'PATCH', body: { schoolId } }),
  listSupervisors: () => request('/admin/supervisors'),
};
