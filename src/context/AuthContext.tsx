import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../models/types';
import { UserRepository } from '../repositories/UserRepository';
import { GoogleOAuthService, GoogleUserProfile } from '../services/GoogleOAuthService';

const AUTH_USER_KEY = '@vagai_auth_user_v2';

interface AuthContextProps {
  currentUser: User | null;
  currentRole: UserRole;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (data: { username: string; password: string; fullNameEn: string; fullNameTa?: string; email?: string; phone?: string; role?: UserRole }) => Promise<{ success: boolean; user?: User; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; needsSetup?: boolean; profile?: GoogleUserProfile; user?: User }>;
  loginWithGoogleDemo: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  currentUser: null,
  currentRole: 'INSTRUCTOR',
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  loginWithGoogleDemo: async () => ({ success: false }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  // Only the user id is persisted; the row (including its password hash) is re-read from the database.
  const rememberSession = async (user: User) => {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: user.id }));
  };

  const loadStoredUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
      if (!stored) return;

      const freshUser = await UserRepository.findById(JSON.parse(stored).id);
      if (freshUser) {
        setCurrentUser(freshUser);
      } else {
        await AsyncStorage.removeItem(AUTH_USER_KEY);
      }
    } catch (e) {
      console.warn('Failed to load session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const user = await UserRepository.verifyCredentials(username, password);
      if (user) {
        setCurrentUser(user);
        await rememberSession(user);
        return { success: true, user };
      }
      return { success: false, error: 'Invalid username or password' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Login failed' };
    }
  };

  const register = async (data: {
    username: string;
    password: string;
    fullNameEn: string;
    fullNameTa?: string;
    email?: string;
    role?: UserRole;
  }): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const user = await UserRepository.createUser(data);
      setCurrentUser(user);
      await rememberSession(user);
      return { success: true, user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Registration failed' };
    }
  };

  const loginWithGoogle = async (): Promise<{
    success: boolean;
    error?: string;
    needsSetup?: boolean;
    profile?: GoogleUserProfile;
    user?: User;
  }> => {
    try {
      const result = await GoogleOAuthService.signInWithGoogle();
      if (result.needsSetup) {
        return { success: false, needsSetup: true, error: result.message };
      }
      if (!result.success || !result.profile) {
        return { success: false, error: result.message || 'Google Sign-In failed' };
      }

      const user = await UserRepository.findOrCreateGoogleUser(result.profile);
      setCurrentUser(user);
      await rememberSession(user);
      return { success: true, profile: result.profile, user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Google Sign-In error' };
    }
  };

  const loginWithGoogleDemo = async (email = 'coach.silambam@gmail.com'): Promise<{ success: boolean; error?: string }> => {
    try {
      const profile = await GoogleOAuthService.signInDemoMode(email);
      const user = await UserRepository.findOrCreateGoogleUser(profile);
      setCurrentUser(user);
      await rememberSession(user);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Demo Sign-In failed' };
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    await GoogleOAuthService.signOut();
  };

  const currentRole: UserRole = currentUser?.role || 'INSTRUCTOR';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isLoading,
        login,
        register,
        loginWithGoogle,
        loginWithGoogleDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

