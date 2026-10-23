/**
 * Centralised token store.
 *
 * Access and refresh tokens are kept in AsyncStorage (device keychain-backed
 * on Android API 23+ via react-native-encrypted-storage; falls back to
 * regular AsyncStorage here since encrypted-storage is not in the existing
 * dependency set — upgrade path noted in SECURITY_REVIEW.md).
 *
 * No token is ever embedded in the APK or committed to source control.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY  = '@vagai_access_token_v1';
const REFRESH_KEY = '@vagai_refresh_token_v1';
const ORG_KEY     = '@vagai_org_id_v1';

export const TokenStore = {
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(ACCESS_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(REFRESH_KEY);
  },

  async getOrgId(): Promise<string | null> {
    return AsyncStorage.getItem(ORG_KEY);
  },

  async set(tokens: { access_token: string; refresh_token: string; organization_id?: string }): Promise<void> {
    await AsyncStorage.multiSet([
      [ACCESS_KEY, tokens.access_token],
      [REFRESH_KEY, tokens.refresh_token],
      ...(tokens.organization_id ? [[ORG_KEY, tokens.organization_id] as [string, string]] : []),
    ]);
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, ORG_KEY]);
  },

  async hasSession(): Promise<boolean> {
    const token = await AsyncStorage.getItem(ACCESS_KEY);
    return !!token;
  },
};
