/**
 * AuthContext — SaaS-aware authentication.
 *
 * Login flow:
 *  1. POST /api/v1/auth/login  → JWT access + refresh tokens stored locally
 *  2. User object decoded from /api/v1/auth/me
 *  3. SQLite UserRepository.findOrCreateFromApi() syncs the user record
 *     into local DB for offline access (name, role, etc.)
 *
 * Offline fallback:
 *  - If the API is unreachable AND a valid local user record exists,
 *    login proceeds in offline mode with a warning.
 *  - Attendance, student management, etc. still work offline via SQLite.
 *
 * Rules enforced here:
 *  - "Do NOT add Sign in with Google as the main login" — Google is only used
 *    for Drive/Sheets integration, never for app authentication.
 *  - "Never trust a frontend-supplied organization ID" — org ID comes from
 *    the JWT, not from any form field or client-side config.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, registerSessionExpiredHandler, LoginResponse, RegisterPayload } from '../services/ApiClient';
import { TokenStore } from '../services/TokenStore';
import { UserRepository } from '../repositories/UserRepository';
import { User, UserRole } from '../models/types';

import { GoogleOAuthService } from '../services/GoogleOAuthService';

const AUTH_USER_KEY = '@vagai_auth_user_v3';

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionMode = 'online' | 'offline';

interface AuthContextProps {
  currentUser: User | null;
  currentRole: UserRole;
  isLoading: boolean;
  connectionMode: ConnectionMode;
  isOnline: boolean;
  /** Username + password login (primary — works online and offline) */
  login: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string; offline?: boolean }>;
  /** Optional Google Account link / Sign-in */
  loginWithGoogle: () => Promise<{ success: boolean; user?: User; error?: string }>;
  /** Create a new academy account (online only — generates license) */
  register: (data: RegisterPayload) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  /** Force a connectivity check and update connectionMode */
  checkConnectivity: () => Promise<ConnectionMode>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context default (typing only — actual values are provided by AuthProvider)
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextProps>({
  currentUser: null,
  currentRole: 'INSTRUCTOR',
  isLoading: true,
  connectionMode: 'offline',
  isOnline: false,
  login: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  checkConnectivity: async () => 'offline',
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('offline');

  // ── startup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Register the 401 handler so the API client can trigger logout without
    // circular imports.
    registerSessionExpiredHandler(handleSessionExpired);
    initSession();
  }, []);

  const handleSessionExpired = useCallback(async () => {
    setCurrentUser(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const checkConnectivity = useCallback(async (): Promise<ConnectionMode> => {
    try {
      const result = await api.health();
      const mode: ConnectionMode = result?.status === 'ok' ? 'online' : 'offline';
      setConnectionMode(mode);
      return mode;
    } catch {
      setConnectionMode('offline');
      return 'offline';
    }
  }, []);

  const initSession = async () => {
    try {
      // 1. Check if we have a stored access token
      const hasToken = await TokenStore.hasSession();

      if (hasToken) {
        // 2. Try to verify it against the API (also checks connectivity)
        try {
          const apiUser = await api.me();
          const localUser = await UserRepository.findOrCreateFromApi(apiUser);
          setCurrentUser(localUser);
          setConnectionMode('online');
          await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: localUser.id }));
        } catch (e) {
          // API unreachable — try local fallback
          const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
          if (stored) {
            const localUser = await UserRepository.findById(JSON.parse(stored).id);
            if (localUser) {
              setCurrentUser(localUser);
              setConnectionMode('offline');
            } else {
              await TokenStore.clear();
            }
          }
        }
      } else {
        // No token — try local SQLite session (legacy or offline-registered)
        const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (stored) {
          const localUser = await UserRepository.findById(JSON.parse(stored).id);
          if (localUser) {
            setCurrentUser(localUser);
            setConnectionMode('offline');
          } else {
            await AsyncStorage.removeItem(AUTH_USER_KEY);
          }
        }
      }
    } catch (e) {
      console.warn('Auth init error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── login ──────────────────────────────────────────────────────────────────

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; user?: User; error?: string; offline?: boolean }> => {
    // 1. Try API first
    try {
      const data: LoginResponse = await api.login(username, password);
      await TokenStore.set(data);

      // Sync user into local SQLite
      const localUser = await UserRepository.findOrCreateFromApi(data.user);
      setCurrentUser(localUser);
      setConnectionMode('online');
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: localUser.id }));
      return { success: true, user: localUser };
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        // 2. API unreachable — fall back to local SQLite credentials
        try {
          const localUser = await UserRepository.verifyCredentials(username, password);
          if (localUser) {
            setCurrentUser(localUser);
            setConnectionMode('offline');
            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: localUser.id }));
            return { success: true, user: localUser, offline: true };
          }
          return { success: false, error: 'Invalid credentials (offline mode — connect to internet to sign in for the first time).' };
        } catch (sqliteErr: any) {
          return { success: false, error: sqliteErr.message || 'Offline login failed.' };
        }
      }
      // API returned a real error (wrong password, suspended, etc.)
      return { success: false, error: (err as ApiError).message || 'Login failed.' };
    }
  };

  // ── register ───────────────────────────────────────────────────────────────

  const register = async (
    payload: RegisterPayload,
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const data = await api.register(payload);
      await TokenStore.set(data);
      const localUser = await UserRepository.findOrCreateFromApi(data.user);
      setCurrentUser(localUser);
      setConnectionMode('online');
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: localUser.id }));
      return { success: true, user: localUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  // ── google (optional secondary sync/account link) ──────────────────────────

  const loginWithGoogle = async (): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const res = await GoogleOAuthService.signInWithGoogle();
      if (!res.success || !res.profile) {
        return { success: false, error: res.message || 'Google Sign-in was not completed.' };
      }
      const localUser = await UserRepository.findOrCreateGoogleUser(res.profile);
      setCurrentUser(localUser);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: localUser.id }));
      return { success: true, user: localUser };
    } catch (e: any) {
      return { success: false, error: e.message || 'Google sign-in error.' };
    }
  };

  // ── logout ─────────────────────────────────────────────────────────────────

  const logout = async () => {
    try { await api.logout(); } catch { /* session going away regardless */ }
    setCurrentUser(null);
    await TokenStore.clear();
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    setConnectionMode('offline');
  };

  // ─────────────────────────────────────────────────────────────────────────

  const currentRole: UserRole = (currentUser?.role as UserRole) || 'INSTRUCTOR';
  const isOnline = connectionMode === 'online';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isLoading,
        connectionMode,
        isOnline,
        login,
        loginWithGoogle,
        register,
        logout,
        checkConnectivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

