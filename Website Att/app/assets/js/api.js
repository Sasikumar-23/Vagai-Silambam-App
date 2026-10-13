/* Single place where the browser talks to FastAPI. Every call goes through here so
   auth headers, error envelopes and session expiry are handled once. */

const API_BASE = window.VAGAI_API_BASE || 'http://localhost:8000';

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
  subscription: () => request('/api/v1/subscription'),

  // Admin
  adminOverview: () => request('/api/v1/admin/overview'),
  listOrganizations: () => request('/api/v1/admin/organizations'),
  suspendOrg: (id) => request(`/api/v1/admin/organizations/${id}/suspend`, { method: 'POST' }),
  activateOrg: (id) => request(`/api/v1/admin/organizations/${id}/activate`, { method: 'POST' }),
  updateOrgPlan: (id, payload) => request(`/api/v1/admin/organizations/${id}/subscription`, { method: 'PUT', body: payload }),
  listAuditLogs: () => request('/api/v1/admin/audit-logs'),
};

