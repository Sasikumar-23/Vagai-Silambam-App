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

  listStudents: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== '' && value != null)
    );
    return request(`/api/v1/students?${query}`);
  },
  createStudent: (payload) => request('/api/v1/students', { method: 'POST', body: payload }),
  updateStudent: (id, payload) => request(`/api/v1/students/${id}`, { method: 'PUT', body: payload }),
  deactivateStudent: (id) => request(`/api/v1/students/${id}`, { method: 'DELETE' }),

  plans: () => request('/api/v1/plans', { auth: false }),
  subscription: () => request('/api/v1/subscription'),
};
