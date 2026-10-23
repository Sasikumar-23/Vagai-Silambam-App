/**
 * Vagai Silambam — API Client
 *
 * All HTTP communication with the FastAPI backend goes through this module.
 * Features:
 *  - Attaches Bearer token to every authenticated request
 *  - One silent refresh attempt on 401 before clearing session
 *  - Offline detection (fetch throws NetworkError when device is offline)
 *  - Typed error envelope: { code, message, fields? }
 *  - No database passwords, Supabase keys, or payment secrets are sent from here
 */

import { API_V1, REQUEST_TIMEOUT_MS } from '../config/api';
import { TokenStore } from './TokenStore';

// ─────────────────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetworkError() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden()    { return this.status === 403; }
  get isPlanLimit()    { return this.status === 402 || this.code === 'PLAN_LIMIT_REACHED'; }
  get isSuspended()    { return this.code === 'ORGANIZATION_SUSPENDED'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function parseError(response: Response): Promise<ApiError> {
  let body: any = {};
  try { body = await response.json(); } catch { /* non-JSON body */ }
  return new ApiError(
    response.status,
    body.code || 'HTTP_ERROR',
    body.message || body.detail || 'Something went wrong. Please try again.',
    body.fields,
  );
}

function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new ApiError(0, 'TIMEOUT', 'Request timed out. Check your connection.')), ms);
    promise.then(res => { clearTimeout(id); resolve(res); }).catch(err => { clearTimeout(id); reject(err); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core request function
// ─────────────────────────────────────────────────────────────────────────────

let _onSessionExpired: (() => void) | null = null;

/** Register a callback so AuthContext can react to 401 (session expiry). */
export function registerSessionExpiredHandler(handler: () => void) {
  _onSessionExpired = handler;
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    auth?: boolean;
    retry?: boolean;
  } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await TokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${API_V1}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
      REQUEST_TIMEOUT_MS,
    );
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your internet connection.');
  }

  // Silent refresh on 401
  if (response.status === 401 && auth && retry) {
    const refreshToken = await TokenStore.getRefreshToken();
    if (refreshToken) {
      const refreshed = await tryRefresh(refreshToken);
      if (refreshed) return request<T>(path, { ...options, retry: false });
    }
    await TokenStore.clear();
    _onSessionExpired?.();
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null as unknown as T;
  return response.json() as Promise<T>;
}

async function tryRefresh(refreshToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_V1}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    await TokenStore.set(data);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API surface — mirrors backend router endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Auth
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  organization_id: string;
  user: {
    id: string;
    username: string;
    full_name_en: string;
    full_name_ta: string;
    email?: string;
    phone?: string;
    role: 'ADMIN' | 'INSTRUCTOR' | 'STAFF' | 'SUPER_ADMIN';
  };
}

export interface RegisterPayload {
  organization_name: string;
  full_name_en: string;
  full_name_ta?: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface RegisterResponse extends LoginResponse {
  license_key: string;
  organization_code: string;
  trial_ends_at: string;
}

// Subscription
export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_students: number;
  max_branches: number;
  max_users: number;
  features: string[];
}

export interface SubscriptionInfo {
  plan: Plan;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'PENDING' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  trial_ends_at: string | null;
  current_period_end: string | null;
  license_key: string;
  organization_code: string;
  limits: { students: number; branches: number; users: number };
  usage: { students: number; branches: number; users: number };
}

// Students (lightweight — full CRUD handled via repositories when offline)
export interface ApiStudent {
  id: string;
  student_code: string;
  name_en: string;
  name_ta?: string;
  contact_number?: string;
  student_status: 'ACTIVE' | 'INACTIVE';
  training_level?: string;
}

export interface StudentListResponse {
  items: ApiStudent[];
  total: number;
}

// Attendance sync
export interface AttendanceMarkPayload {
  student_id: string;
  date: string;          // YYYY-MM-DD
  session_name: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
  remarks?: string | null;
}

export interface AttendanceSyncResult {
  synced: number;
  failed: number;
  errors: Array<{ student_id: string; error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported API object
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password }, auth: false }),

  register: (payload: RegisterPayload) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),

  me: () => request<LoginResponse['user']>('/auth/me'),

  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  refreshToken: (refresh_token: string) =>
    request<LoginResponse>('/auth/refresh', { method: 'POST', body: { refresh_token }, auth: false }),

  // Subscription
  plans: () => request<Plan[]>('/plans', { auth: false }),
  subscription: () => request<SubscriptionInfo>('/subscription'),

  // Students (remote, for sync/audit — local SQLite is the primary offline store)
  listStudents: (params?: { status?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as any).toString() : '';
    return request<StudentListResponse>(`/students${qs}`);
  },

  // Attendance sync — sends local SQLite queue to the API → Google Sheets
  markAttendance: (payload: AttendanceMarkPayload) =>
    request<{ success: boolean }>('/attendance/mark', { method: 'POST', body: payload }),

  syncAttendanceBatch: (records: AttendanceMarkPayload[]) =>
    Promise.allSettled(records.map(r => api.markAttendance(r))),

  // Google Connect status (for settings screen)
  googleConnectStatus: () =>
    request<{ connected: boolean; google_email?: string; attendance_spreadsheet_id?: string }>('/google/status'),

  // Reports summary
  reportsSummary: () =>
    request<{
      active_students: number;
      fees_collected: number;
      pending_fees: number;
      upcoming_events: number;
      pending_uniforms: number;
    }>('/reports/summary'),

  // Health check (used on app startup to detect connectivity)
  health: () =>
    fetch(`${API_V1.replace('/api/v1', '')}/health`)
      .then(r => r.json())
      .catch(() => ({ status: 'offline' })),
};
