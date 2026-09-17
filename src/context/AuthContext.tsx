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
  loginWithGoogle: (selectedRole?: UserRole) => Promise<{ success: boolean; error?: string; needsSetup?: boolean; profile?: GoogleUserProfile; user?: User }>;
  loginWithGoogleDemo: (email?: string, selectedRole?: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  setUserRole: (role: UserRole) => Promise<void>;
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
  switchRole: async () => {},
  setUserRole: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const freshUser = await UserRepository.findById(parsed.id);
        if (freshUser) {
          setCurrentUser(freshUser);
        } else {
          // Fallback to instructor
          const defaultUser = await UserRepository.switchRoleForDemo('INSTRUCTOR');
          setCurrentUser(defaultUser);
        }
      } else {
        // Default to instructor for fast mobile demo
        const defaultUser = await UserRepository.switchRoleForDemo('INSTRUCTOR');
        if (defaultUser) {
          setCurrentUser(defaultUser);
          await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(defaultUser));
        }
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
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
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
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Registration failed' };
    }
  };

  const loginWithGoogle = async (selectedRole: UserRole = 'INSTRUCTOR'): Promise<{
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

      const user = await UserRepository.findOrCreateGoogleUser(result.profile, selectedRole);
      setCurrentUser(user);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      return { success: true, profile: result.profile, user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Google Sign-In error' };
    }
  };

  const loginWithGoogleDemo = async (email = 'coach.silambam@gmail.com', selectedRole: UserRole = 'INSTRUCTOR'): Promise<{ success: boolean; error?: string }> => {
    try {
      const profile = await GoogleOAuthService.signInDemoMode(email);
      const user = await UserRepository.findOrCreateGoogleUser(profile, selectedRole);
      setCurrentUser(user);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
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

  const switchRole = async (role: UserRole) => {
    const user = await UserRepository.switchRoleForDemo(role);
    if (user) {
      setCurrentUser(user);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
  };

  const setUserRole = async (role: UserRole) => {
    if (currentUser?.id) {
      const updated = await UserRepository.updateUserRole(currentUser.id, role);
      if (updated) {
        setCurrentUser(updated);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
      }
    }
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
        switchRole,
        setUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

