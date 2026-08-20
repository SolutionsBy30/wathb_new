const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'wathb_admin_session_token';

export function getToken() {
  return localStorage.getItem(SESSION_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

/**
 * ADM-032 — uploaded artwork is stored as a root-relative `/api/uploads/...`
 * path. Production serves it from the same origin as the admin app; dev has
 * the app on :5173 and the API on :4000, so resolve against the API origin.
 * An absolute URL (author-hosted image) passes through unchanged.
 */
export function mediaUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
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

  // Admin management needs deactivated tests too — /tests hides them.
  listTests: () => request('/admin/tests'),
  tree: (testId) => request(`/tests/${testId}/tree`),
  createTest: (dto) => request('/admin/tests', { method: 'POST', body: dto }),
  updateTest: (id, dto) => request(`/admin/tests/${id}`, { method: 'PATCH', body: dto }),
  createSection: (testId, dto) => request(`/admin/tests/${testId}/sections`, { method: 'POST', body: dto }),
  updateSection: (id, dto) => request(`/admin/sections/${id}`, { method: 'PATCH', body: dto }),
  deleteSection: (id) => request(`/admin/sections/${id}`, { method: 'DELETE' }),
  createArea: (sectionId, dto) => request(`/admin/sections/${sectionId}/areas`, { method: 'POST', body: dto }),
  updateArea: (id, dto) => request(`/admin/areas/${id}`, { method: 'PATCH', body: dto }),
  deleteArea: (id) => request(`/admin/areas/${id}`, { method: 'DELETE' }),
  createLabel: (areaId, dto) => request(`/admin/areas/${areaId}/labels`, { method: 'POST', body: dto }),
  updateLabel: (id, dto) => request(`/admin/labels/${id}`, { method: 'PATCH', body: dto }),
  retireLabel: (id) => request(`/admin/labels/${id}/retire`, { method: 'POST' }),
  // ADM-095 — hard delete; the API refuses it unless the label is empty.
  deleteLabel: (id) => request(`/admin/labels/${id}`, { method: 'DELETE' }),
  // ADM-093 — الاختبار ← القسم ← المجال ← التصنيف, one row per label.
  exportTaxonomy: () => request('/admin/taxonomy/export'),

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

  reviewQueue: () => request('/admin/questions/review-queue'),
  approveQuestion: (id, comment) => request(`/admin/questions/${id}/approve`, { method: 'POST', body: { comment } }),
  rejectQuestion: (id, comment) => request(`/admin/questions/${id}/reject`, { method: 'POST', body: { comment } }),

  listProblemReports: (status) => request(`/admin/questions/problem-reports${status ? `?status=${status}` : ''}`),
  resolveProblemReport: (id) => request(`/admin/questions/problem-reports/${id}/resolve`, { method: 'POST' }),

  // ADM-032 — upload artwork for a stem or an option; returns { url } to
  // store on the version being saved.
  uploadQuestionImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/admin/questions/images', { method: 'POST', body: form, isForm: true });
  },

  importCsv: (file, labelId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('labelId', labelId);
    return request('/admin/questions/import', { method: 'POST', body: form, isForm: true });
  },
  patchImportRow: (jobId, rowIndex, patch) => request(`/admin/questions/import/${jobId}/rows/${rowIndex}`, { method: 'PATCH', body: patch }),
  // ADM-094 — skipInvalid imports the valid rows and drops the rest.
  commitImport: (jobId, skipInvalid = false) => request(`/admin/questions/import/${jobId}/commit`, { method: 'POST', body: { skipInvalid } }),

  deliveryLog: () => request('/admin/notifications'),
  // NOT-017 — the pool of daily-leap message variants.
  listNotificationMessages: () => request('/admin/notifications/messages'),
  messagePlaceholders: () => request('/admin/notifications/messages/placeholders'),
  previewNotificationMessage: (body) => request('/admin/notifications/messages/preview', { method: 'POST', body: { body } }),
  createNotificationMessage: (dto) => request('/admin/notifications/messages', { method: 'POST', body: dto }),
  updateNotificationMessage: (id, dto) => request(`/admin/notifications/messages/${id}`, { method: 'PATCH', body: dto }),
  deleteNotificationMessage: (id) => request(`/admin/notifications/messages/${id}`, { method: 'DELETE' }),
  planDayAll: () => request('/admin/notifications/plan-day', { method: 'POST', body: {} }),
  sendDueAll: (forDate) => request(`/admin/notifications/send-due${forDate ? `?forDate=${forDate}` : ''}`, { method: 'POST' }),
  previewCampaign: (filter) => request('/admin/notifications/campaign/preview', { method: 'POST', body: filter }),
  sendCampaign: (dto) => request('/admin/notifications/campaign/send', { method: 'POST', body: dto }),
  processRetries: () => request('/admin/notifications/process-retries', { method: 'POST' }),
  // ADM-087 — per-recipient manual sends from the student detail screen.
  sendLeapNow: (studentId, force = false) => request(`/admin/notifications/send-now/${studentId}${force ? '?force=true' : ''}`, { method: 'POST' }),
  // NOT-018 — every active student, ignoring their notification window.
  sendLeapNowAll: (force = false) => request(`/admin/notifications/send-now${force ? '?force=true' : ''}`, { method: 'POST' }),
  sendStudentWeeklyReport: (studentId) => request(`/admin/notifications/weekly-report/student/${studentId}`, { method: 'POST' }),
  sendSupervisorWeeklyReport: (supervisorId) => request(`/admin/notifications/weekly-report/supervisor/${supervisorId}`, { method: 'POST' }),
  undeliveredNotifications: () => request('/admin/notifications/undelivered'),
  // NOT-014 — reset exhausted notifications so the retry ladder runs again.
  requeueFailed: (errorContains) => request('/admin/notifications/requeue-failed', { method: 'POST', body: errorContains ? { errorContains } : {} }),

  listPackages: () => request('/admin/packages'),
  createPackage: (dto) => request('/admin/packages', { method: 'POST', body: dto }),
  updatePackage: (id, dto) => request(`/admin/packages/${id}`, { method: 'PATCH', body: dto }),

  // PAY-011 — promo codes (gated on the 'packages' permission server-side).
  listDiscountCodes: () => request('/admin/discount-codes'),
  createDiscountCode: (dto) => request('/admin/discount-codes', { method: 'POST', body: dto }),
  updateDiscountCode: (id, dto) => request(`/admin/discount-codes/${id}`, { method: 'PATCH', body: dto }),

  paymentStatus: () => request('/admin/payment-status'),
  searchStudent: (mobile) => request(`/admin/students/search?mobile=${encodeURIComponent(mobile)}`),
  activateWireTransfer: (studentId, packageId) => request('/admin/subscriptions/activate-wire-transfer', { method: 'POST', body: { studentId, packageId } }),
  sweepExpiredSubscriptions: () => request('/admin/subscriptions/sweep-expired', { method: 'POST' }),

  // ADM-085 — suspension + audit log
  // ADM-086 — edit a student's or supervisor's contact details.
  updateAccount: (userId, dto) => request(`/admin/accounts/${userId}`, { method: 'PATCH', body: dto }),
  suspendUser: (userId, reason, note) => request(`/admin/users/${userId}/suspend`, { method: 'POST', body: { reason, note } }),
  unsuspendUser: (userId) => request(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),
  auditLog: () => request('/admin/audit-log'),

  // ADM-088 — admin accounts + per-section permissions.
  adminMe: () => request('/admin/admins/me'),
  adminPermissionCatalogue: () => request('/admin/admins/permissions'),
  listAdmins: () => request('/admin/admins'),
  createAdmin: (dto) => request('/admin/admins', { method: 'POST', body: dto }),
  updateAdmin: (id, dto) => request(`/admin/admins/${id}`, { method: 'PATCH', body: dto }),

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
  compareCohorts: (type, ids) => request(`/report/cohort/compare?type=${type}&ids=${ids.join(',')}`),

  adminListRegions: () => request('/admin/geography/regions'),
  adminListCities: (regionId) => request(`/admin/geography/cities${regionId ? `?regionId=${regionId}` : ''}`),
  updateRegion: (id, dto) => request(`/admin/geography/regions/${id}`, { method: 'POST', body: dto }),
  setRegionActive: (id, isActive) => request(`/admin/geography/regions/${id}/active`, { method: 'POST', body: { isActive } }),
  updateCity: (id, dto) => request(`/admin/geography/cities/${id}`, { method: 'POST', body: dto }),
  setCityActive: (id, isActive) => request(`/admin/geography/cities/${id}/active`, { method: 'POST', body: { isActive } }),
  addCityAlias: (id, alias) => request(`/admin/geography/cities/${id}/aliases`, { method: 'POST', body: { alias } }),
  removeCityAlias: (aliasId) => request(`/admin/geography/cities/aliases/${aliasId}`, { method: 'DELETE' }),
  updateSchool: (id, dto) => request(`/admin/geography/schools/${id}`, { method: 'POST', body: dto }),
  mergeSchools: (sourceId, targetId) => request('/admin/geography/schools/merge', { method: 'POST', body: { sourceId, targetId } }),
  studentReport: (id) => request(`/report/student/${id}`),

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
  studentDetail: (id) => request(`/admin/students/${id}/detail`),
  setStudentSchool: (studentId, schoolId) => request(`/admin/students/${studentId}/school`, { method: 'PATCH', body: { schoolId } }),
  listSupervisors: () => request('/admin/supervisors'),

  bulkStatus: (ids, status) => request('/admin/questions/bulk-status', { method: 'POST', body: { ids, status } }),
  mintStudentLoginLink: (studentId) => request(`/admin/students/${studentId}/magic-link`, { method: 'POST' }),
  studentLeaps: (studentId) => request(`/admin/students/${studentId}/leaps`),
  // ADM-097 — one leap's questions with the student's answers.
  leapDetail: (studentId, wathbId) => request(`/admin/students/${studentId}/leaps/${wathbId}`),

  listDailyTips: () => request('/admin/daily-tips'),
  createDailyTip: (textAr) => request('/admin/daily-tips', { method: 'POST', body: { textAr } }),
  updateDailyTip: (id, dto) => request(`/admin/daily-tips/${id}`, { method: 'POST', body: dto }),
  deleteDailyTip: (id) => request(`/admin/daily-tips/${id}`, { method: 'DELETE' }),
};
