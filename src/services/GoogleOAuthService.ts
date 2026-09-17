import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { SettingsRepository } from '../repositories/SettingsRepository';

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresAt?: number;
  isDemoMode?: boolean;
}

const STORAGE_KEY_OAUTH_TOKEN = '@vagai_google_oauth_token';
const STORAGE_KEY_USER_PROFILE = '@vagai_google_user_profile';
const SETTING_OAUTH_CLIENT_ID = 'google_oauth_client_id';

// Google Cloud Console Web Client ID (used by Google Play Services on Android)
const DEFAULT_WEB_CLIENT_ID = '111572452174-3gaongs4kt7lkj4k1b92mdjlr9f24af3.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
];

// Configure Google Play Services native Sign-In SDK
if (Platform.OS !== 'web') {
  try {
    GoogleSignin.configure({
      webClientId: DEFAULT_WEB_CLIENT_ID,
      scopes: SCOPES,
      offlineAccess: true,
    });
  } catch (e) {
    console.warn('GoogleSignin configure error:', e);
  }
}

export const GoogleOAuthService = {
  /**
   * Check if user is currently signed in with Google
   */
  async getCurrentUser(): Promise<GoogleUserProfile | null> {
    try {
      const profileRaw = await AsyncStorage.getItem(STORAGE_KEY_USER_PROFILE);
      if (!profileRaw) return null;
      return JSON.parse(profileRaw) as GoogleUserProfile;
    } catch {
      return null;
    }
  },

  /**
   * Get valid access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const profile = await this.getCurrentUser();
      if (!profile) return null;
      // If demo mode token, return null so real API calls are skipped gracefully
      if (profile.isDemoMode) return null;

      // In native mode, refresh or get fresh tokens from GoogleSignin if expired
      if (Platform.OS !== 'web' && (!profile.expiresAt || Date.now() > profile.expiresAt - 60000)) {
        try {
          const tokens = await GoogleSignin.getTokens();
          if (tokens.accessToken) {
            profile.accessToken = tokens.accessToken;
            profile.expiresAt = Date.now() + 3600 * 1000;
            await this.saveProfile(profile);
            return tokens.accessToken;
          }
        } catch {
          // Fall back to saved token
        }
      }

      return profile.accessToken || null;
    } catch {
      return null;
    }
  },

  /**
   * Get the configured OAuth Client ID
   */
  async getClientId(): Promise<string> {
    const saved = await SettingsRepository.getSetting(SETTING_OAUTH_CLIENT_ID, DEFAULT_WEB_CLIENT_ID);
    if (!saved || !saved.trim() || saved.includes('362937018389')) {
      return DEFAULT_WEB_CLIENT_ID;
    }
    return saved.trim();
  },

  /**
   * Save the OAuth Client ID
   */
  async setClientId(clientId: string): Promise<void> {
    await SettingsRepository.setSetting(SETTING_OAUTH_CLIENT_ID, clientId.trim());
    if (Platform.OS !== 'web') {
      try {
        GoogleSignin.configure({
          webClientId: clientId.trim(),
          scopes: SCOPES,
          offlineAccess: true,
        });
      } catch (e) {
        console.warn('GoogleSignin reconfigure error:', e);
      }
    }
  },

  /**
   * 1-Tap Native Google Sign-In using Google Play Services SDK
   */
  async signInWithGoogle(): Promise<{
    success: boolean;
    profile?: GoogleUserProfile;
    message?: string;
    needsSetup?: boolean;
  }> {
    try {
      if (Platform.OS !== 'web') {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();

          if (response.type === 'cancelled') {
            return { success: false, message: 'Sign-in was cancelled.' };
          }

          const user = response.data.user;
          const tokens = await GoogleSignin.getTokens();

          if (tokens.accessToken) {
            const profile: GoogleUserProfile = {
              id: user.id || `g_${Date.now()}`,
              email: user.email,
              name: user.name || user.givenName || user.email.split('@')[0],
              picture: user.photo || undefined,
              accessToken: tokens.accessToken,
              expiresAt: Date.now() + 3600 * 1000,
              isDemoMode: false,
            };
            await this.saveProfile(profile);
            return { success: true, profile };
          }

          return { success: false, message: 'Could not obtain access token from Google.' };
        } catch (error: any) {
          if (isErrorWithCode(error)) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
              return { success: false, message: 'Sign-in was cancelled.' };
            } else if (error.code === statusCodes.IN_PROGRESS) {
              return { success: false, message: 'Sign-in is already in progress.' };
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
              return { success: false, message: 'Google Play Services not available or outdated on this device.' };
            }
          }
          console.warn('Native Google Sign-In error:', error);
          return { success: false, message: error.message || 'Google Sign-In failed.' };
        }
      }

      // Web / fallback: Demo Mode
      const profile = await this.signInDemoMode();
      return { success: true, profile };
    } catch (err: any) {
      console.warn('Google OAuth error:', err);
      return { success: false, message: err.message || 'Google Sign-In encountered an error.' };
    }
  },

  /**
   * Connect in Demo Mode — no Google Cloud account required.
   * Simulates a connected account so the UI and folder hierarchy work locally.
   * Note: actual Drive API calls are skipped (files saved locally only).
   */
  async signInDemoMode(emailOverride?: string): Promise<GoogleUserProfile> {
    const email = emailOverride?.trim() || 'demo.academy@gmail.com';
    const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const demoProfile: GoogleUserProfile = {
      id: `demo_${Date.now()}`,
      email,
      name,
      accessToken: `DEMO_TOKEN_${Date.now()}`,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year (demo doesn't expire)
      isDemoMode: true,
    };
    await this.saveProfile(demoProfile);
    return demoProfile;
  },

  /**
   * Save user profile to AsyncStorage and settings
   */
  async saveProfile(profile: GoogleUserProfile): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
    await AsyncStorage.setItem(STORAGE_KEY_OAUTH_TOKEN, profile.accessToken);
    await SettingsRepository.setSetting('google_drive_user_email', profile.email);
  },

  /**
   * Sign out and clear all tokens
   */
  async signOut(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut();
      }
    } catch (e) {
      console.warn('GoogleSignin.signOut error:', e);
    }
    await AsyncStorage.removeItem(STORAGE_KEY_USER_PROFILE);
    await AsyncStorage.removeItem(STORAGE_KEY_OAUTH_TOKEN);
    await SettingsRepository.setSetting('google_drive_user_email', '');
  },
};
