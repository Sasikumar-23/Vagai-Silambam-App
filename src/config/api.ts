/**
 * Centralised API configuration.
 *
 * Rules:
 *  - Never embed database passwords, Supabase service-role keys, payment
 *    secrets, or Google OAuth refresh tokens here.
 *  - Only the API base URL is stored here; all secrets live on the server.
 *  - The production URL is read from the EAS environment variable
 *    EXPO_PUBLIC_API_URL, falling back to localhost for local development.
 */

import Constants from 'expo-constants';

// EAS environment variable (set per build profile — see eas.json)
// In dev: falls back to localhost so the Expo Go / local simulator works.
const expoPublicApiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL: string =
  expoPublicApiUrl || 'http://10.0.2.2:8000'; // Android emulator loopback

// Convenience constant that all API modules import.
export const API_V1 = `${API_BASE_URL}/api/v1`;

// Network timeout (ms). Offline detection relies on this + fetch error.
export const REQUEST_TIMEOUT_MS = 15_000;
