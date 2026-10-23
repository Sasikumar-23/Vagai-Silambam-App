/* Single place where the browser talks to FastAPI. Every call goes through here so
   auth headers, error envelopes and session expiry are handled once. */

const API_BASE = window.VAGAI_API_BASE
  || localStorage.getItem('vagai_api_base')
  || 'https://vagai-silambam-app.vercel.app';

const TOKEN_KEY = 'vagai_access_token';
const REFRESH_KEY = 'vagai_refresh_token';

export const tokens = {
  get access() { return localStorage.getItem(TOKEN_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set({ access_token, refresh_token }) {
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REFRESH_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || [];
  }
}

async function parseError(response) {
  let body = {};
  try { body = await response.json(); } catch { /* empty or non-JSON body */ }
  return new ApiError(
    response.status,
    body.code || 'HTTP_ERROR',
    body.message || 'Something went wrong. Please try again.',
    body.fields
  );
}

async function request(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }

  // One silent refresh attempt, then give up and send the user to login.
  if (response.status === 401 && auth && retry && tokens.refresh) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, { method, body, auth, retry: false });
    tokens.clear();
    if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
  }

  if (!response.ok) throw await parseError(response);
  return response.status === 204 ? null : response.json();
}

async function refreshSession() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh }),
    });
    if (!response.ok) return false;
    tokens.set(await response.json());
    return true;
  } catch {
    return false;
  }
}

export const api = {
  register: (payload) => request('/api/v1/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/v1/auth/login', { method: 'POST', body: payload, auth: false }),
  logout: () => request('/api/v1/auth/logout', { method: 'POST' }),
  me: () => request('/api/v1/auth/me'),

  // Students
  listStudents: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== '' && value != null)
    );
    return request(`/api/v1/students?${query}`);
  },
  getStudent: (id) => request(`/api/v1/students/${id}`),
  createStudent: (payload) => request('/api/v1/students', { method: 'POST', body: payload }),
  updateStudent: (id, payload) => request(`/api/v1/students/${id}`, { method: 'PUT', body: payload }),
  deactivateStudent: (id) => request(`/api/v1/students/${id}`, { method: 'DELETE' }),
  importStudents: (items) => request('/api/v1/students/import', { method: 'POST', body: items }),

  // Events
  listEvents: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/events?${query}`);
  },
  getEvent: (id) => request(`/api/v1/events/${id}`),
  createEvent: (payload) => request('/api/v1/events', { method: 'POST', body: payload }),
  updateEvent: (id, payload) => request(`/api/v1/events/${id}`, { method: 'PUT', body: payload }),
  listRegistrations: (eventId) => request(`/api/v1/events/${eventId}/registrations`),
  registerStudentForEvent: (eventId, payload) =>
    request(`/api/v1/events/${eventId}/registrations`, { method: 'POST', body: payload }),
  recordEventResult: (eventId, payload) =>
    request(`/api/v1/events/${eventId}/results`, { method: 'POST', body: payload }),

  // Fees
  listFees: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/fees?${query}`);
  },
  createFee: (payload) => request('/api/v1/fees', { method: 'POST', body: payload }),
  payFee: (id, payload) => request(`/api/v1/fees/${id}/pay`, { method: 'POST', body: payload }),
  exportFeesCSV: () => fetch(`${API_BASE}/api/v1/reports/export/fees.csv`, {
    headers: { Authorization: `Bearer ${tokens.access}` }
  }),

  // Uniforms
  listUniforms: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/uniforms?${query}`);
  },
  orderUniform: (payload) => request('/api/v1/uniforms', { method: 'POST', body: payload }),
  updateUniform: (id, payload) => request(`/api/v1/uniforms/${id}`, { method: 'PATCH', body: payload }),

  // Certificates & Achievements
  listCertificates: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/certificates?${query}`);
  },
  issueCertificate: (payload) => request('/api/v1/certificates', { method: 'POST', body: payload }),
  listAchievements: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/certificates/achievements?${query}`);
  },
  addAchievement: (payload) => request('/api/v1/certificates/achievements', { method: 'POST', body: payload }),

  // Attendance
  markAttendance: (payload) => request('/api/v1/attendance/mark', { method: 'POST', body: payload }),
  getStudentAttendance: (studentId, params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/api/v1/attendance/student/${studentId}?${query}`);
  },
  googleConnectStatus: () => request('/api/v1/google/connect-status'),

  // Reports
  reportsSummary: () => request('/api/v1/reports/summary'),
  exportStudentsCSV: () => fetch(`${API_BASE}/api/v1/reports/export/students.csv`, {
    headers: { Authorization: `Bearer ${tokens.access}` }
  }),

  // Subscription & Plans
  plans: () => request('/api/v1/plans', { auth: false }),
  listUsers: () => request('/api/v1/users'),
  createUser: (payload) => request('/api/v1/users', { method: 'POST', body: payload }),
  revokeLicense: (id) => request(`/api/v1/users/${id}/license/revoke`, { method: 'POST' }),
  reissueLicense: (id) => request(`/api/v1/users/${id}/license/reissue`, { method: 'POST' }),
  changeMemberRole: (id, role) => request(`/api/v1/users/${id}/role`, { method: 'PATCH', body: { role } }),
  resetAcademyAdminPassword: (orgId, newPassword) =>
    request(`/api/v1/admin/organizations/${orgId}/reset-admin-password`, { method: 'POST', body: { new_password: newPassword } }),
  subscription: () => request('/api/v1/subscription'),

  // Admin
  adminOverview: () => request('/api/v1/admin/overview'),
  listPayments: (orgId) => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u.role && u.role !== 'SUPER_ADMIN') {
        return request('/api/v1/subscription/payments');
      }
    } catch (_) {}
    return request(`/api/v1/admin/payments${orgId ? `?organization_id=${encodeURIComponent(orgId)}` : ''}`);
  },
  verifyPayment: (paymentId, payload = {}) =>
    request(`/api/v1/admin/payments/${paymentId}/verify`, { method: 'POST', body: payload }),
  listAcademyLicenses: () => request('/api/v1/admin/licenses'),
  revokeAcademyLicense: (licenseId) => request(`/api/v1/admin/licenses/${licenseId}/revoke`, { method: 'POST' }),
  listEmailLogs: () => request('/api/v1/admin/email-logs'),
  adminPlans: () => request('/api/v1/admin/plans'),
  createPlan: (payload) => request('/api/v1/admin/plans', { method: 'POST', body: payload }),
  updatePlan: (id, payload) => request(`/api/v1/admin/plans/${id}`, { method: 'PUT', body: payload }),
  listAppActivations: () => request('/api/v1/admin/app-activations'),
  listApiLogs: (pathContains = '') =>
    request(`/api/v1/admin/api-logs${pathContains ? `?path_contains=${encodeURIComponent(pathContains)}` : ''}`),
  retryEmails: () => request('/api/v1/admin/email-logs/retry', { method: 'POST' }),
  generateAcademyLicense: (orgId, expiresAt = null) =>
    request(`/api/v1/admin/organizations/${orgId}/generate-license`, { method: 'POST', body: { expires_at: expiresAt } }),
  // backend returns a flat array; wrap so callers can do res.organizations
  listOrganizations: async () => {
    const list = await request('/api/v1/admin/organizations');
    return { organizations: Array.isArray(list) ? list : [] };
  },
  suspendOrg: (id) => request(`/api/v1/admin/organizations/${id}/suspend`, { method: 'POST' }),
  activateOrg: (id) => request(`/api/v1/admin/organizations/${id}/activate`, { method: 'POST' }),
  // payload must contain { plan_code: string }
  updateOrgPlan: (id, payload) => request(`/api/v1/admin/organizations/${id}/subscription`, { method: 'PUT', body: payload }),
  // payload: { organization_id, plan_code, amount, duration_months, payment_mode, status, receipt_number, notes }
  recordOfflinePayment: (payload) => request('/api/v1/admin/subscriptions/record-offline-payment', { method: 'POST', body: payload }),
  listAuditLogs: () => request('/api/v1/admin/audit-logs'),
};

