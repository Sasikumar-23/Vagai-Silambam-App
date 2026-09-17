import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { SettingsRepository } from '../repositories/SettingsRepository';

WebBrowser.maybeCompleteAuthSession();

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

// Real Google Cloud Console OAuth 2.0 Web Client ID
const DEFAULT_CLIENT_ID = '111572452174-3gaongs4kt7lkj4k1b92mdjlr9f24af3.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

/**
 * Check if the provided client ID is a real Google OAuth client ID
 * (must end with .apps.googleusercontent.com and not be a placeholder)
 */
function isValidClientId(clientId: string): boolean {
  return (
    Boolean(clientId) &&
    clientId.endsWith('.apps.googleusercontent.com') &&
    !clientId.includes('vagai-silambam-app') &&        // old placeholder
    !clientId.includes('YOUR_CLIENT_ID') &&
    clientId.length > 40
  );
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
      return profile.accessToken || null;
    } catch {
      return null;
    }
  },

  /**
   * Get the configured OAuth Client ID
   */
  async getClientId(): Promise<string> {
    const saved = await SettingsRepository.getSetting(SETTING_OAUTH_CLIENT_ID, DEFAULT_CLIENT_ID);
    if (!saved || !saved.trim() || saved.includes('362937018389')) {
      return DEFAULT_CLIENT_ID;
    }
    return saved.trim();
  },

  /**
   * Save the OAuth Client ID
   */
  async setClientId(clientId: string): Promise<void> {
    await SettingsRepository.setSetting(SETTING_OAUTH_CLIENT_ID, clientId.trim());
  },

  /**
   * 1-Tap Google Sign-In Flow using expo-auth-session
   * Returns { needsSetup: true } when no valid OAuth client ID is configured.
   */
  async signInWithGoogle(): Promise<{
    success: boolean;
    profile?: GoogleUserProfile;
    message?: string;
    needsSetup?: boolean;
  }> {
    try {
      const clientId = await this.getClientId();

      if (!isValidClientId(clientId)) {
        return {
          success: false,
          needsSetup: true,
          message: 'Google Cloud OAuth Client ID not configured.',
        };
      }

      const isWeb = Platform.OS === 'web';

      // ─────────────────────────────────────────────────────────────────
      // Expo Go detection: auth.expo.io relay is deprecated & broken.
      // Google OAuth only works in a proper development/production build.
      // ─────────────────────────────────────────────────────────────────
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && !isWeb) {
        return {
          success: false,
          message:
            'Google Sign-In is not supported in Expo Go (the auth proxy is deprecated).\n\n' +
            'Please install the development build APK and try again.',
        };
      }

      // For production APK: PKCE + localhost redirect (always allowed by Google Web client)
      // Add http://localhost to Authorized redirect URIs in Google Cloud Console
      const redirectUri = isWeb
        ? AuthSession.makeRedirectUri({ scheme: 'vagaisilambam' })
        : 'http://localhost';

      const discovery: AuthSession.DiscoveryDocument = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        scopes: SCOPES,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
          prompt: 'select_account',
          access_type: 'online',
        },
      });

      console.log('=== GOOGLE OAUTH DEBUG ===');
      console.log('Redirect URI:', redirectUri);
      console.log('Client ID:', clientId);

      const result = await request.promptAsync(discovery);

      console.log('=== AUTH REQUEST RESULT ===', JSON.stringify(result));

      if (result.type === 'success') {
        // PKCE Code flow: exchange authorization code for access token
        const code = result.params?.code;
        if (!code) {
          return { success: false, message: 'No authorization code received from Google.' };
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: [
            `code=${encodeURIComponent(code)}`,
            `client_id=${encodeURIComponent(clientId)}`,
            `redirect_uri=${encodeURIComponent(redirectUri)}`,
            `grant_type=authorization_code`,
            `code_verifier=${encodeURIComponent(request.codeVerifier || '')}`,
          ].join('&'),
        });

        const tokenData = await tokenResponse.json();
        console.log('Token exchange result:', JSON.stringify(tokenData));

        if (tokenData.access_token) {
          const profile = await this.fetchUserProfile(tokenData.access_token, tokenData.expires_in || 3600);
          return { success: true, profile };
        }

        return { success: false, message: tokenData.error_description || 'Token exchange failed.' };
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { success: false, message: 'Sign-in was cancelled.' };
      }

      return { success: false, message: `Auth failed (type: ${result.type}).` };
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
   * Fetch user info from Google OAuth2 API
   */
  async fetchUserProfile(accessToken: string, expiresIn = 3600): Promise<GoogleUserProfile> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        const profile: GoogleUserProfile = {
          id: data.id || `g_${Date.now()}`,
          email: data.email,
          name: data.name || data.email.split('@')[0],
          picture: data.picture,
          accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
          isDemoMode: false,
        };
        await this.saveProfile(profile);
        return profile;
      }
    } catch (e) {
      console.warn('Error fetching userinfo from Google:', e);
    }

    // Fallback: save token even if userinfo call fails
    const fallback: GoogleUserProfile = {
      id: `google_${Date.now()}`,
      email: 'academy@gmail.com',
      name: 'Silambam Master',
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      isDemoMode: false,
    };
    await this.saveProfile(fallback);
    return fallback;
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
    await AsyncStorage.removeItem(STORAGE_KEY_USER_PROFILE);
    await AsyncStorage.removeItem(STORAGE_KEY_OAUTH_TOKEN);
    await SettingsRepository.setSetting('google_drive_user_email', '');
  },
};
