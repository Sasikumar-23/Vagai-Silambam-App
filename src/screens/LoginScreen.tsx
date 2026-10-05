import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { TextInput } from 'react-native-paper';
import {
  ArrowRight, ShieldCheck, Lock,
  Sparkles, UserPlus, LogIn, Check
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../models/types';

// Admin is deliberately absent: it is granted to the first account only, never chosen.
const SIGNUP_ROLES: Array<{ role: UserRole; labelEn: string; labelTa: string; icon: string }> = [
  { role: 'INSTRUCTOR', labelEn: 'Instructor', labelTa: 'மாஸ்டர்', icon: '🥋' },
  { role: 'STAFF', labelEn: 'Staff', labelTa: 'பணியாளர்', icon: '📋' },
];

export default function LoginScreen({ navigation }: any) {
  const { t, language } = useI18n();
  const { login, register, loginWithGoogle, currentUser } = useAuth();

  // Auth mode: 'LOGIN' | 'REGISTER'
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [fullNameTa, setFullNameTa] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [signupRole, setSignupRole] = useState<UserRole>('INSTRUCTOR');
  const [isFirstAccount, setIsFirstAccount] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    UserRepository.countUsers()
      .then(count => setIsFirstAccount(count === 0))
      .catch(() => setIsFirstAccount(false));
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Google Sign In
  // ─────────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        Alert.alert(
          'Sign In Note',
          result.error || 'Google Sign-in was not completed.'
        );
      }
    } catch (e: any) {
      Alert.alert('Sign In Error', e.message || 'Error completing Google Sign-In.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Username / Password Login
  // ─────────────────────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter username and password.');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password.trim());
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials.');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Create New User Account
  // ─────────────────────────────────────────────────────────────────
  const handleCreateAccount = async () => {
    if (!fullNameEn.trim()) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter a Username and Password.');
      return;
    }

    setLoading(true);
    const result = await register({
      fullNameEn: fullNameEn.trim(),
      fullNameTa: fullNameTa.trim() || undefined,
      username: username.trim(),
      password: password.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      role: signupRole,
    });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error || 'Could not create account.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Branding */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>VAGAI SILAMBAM</Text>
          <Text style={styles.brandTitleTa}>வாகை சிலம்பம் கழகம்</Text>
          <Text style={styles.brandSubtitle}>
            Traditional Martial Arts Training Platform
          </Text>
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* STEP 1: AUTHENTICATION (Sign In / Create User, then Google)  */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {(
          <View style={styles.card}>
            {/* Top: Auth Mode Toggle (Sign In vs Create User) */}
            <View style={styles.authModeToggle}>
              <TouchableOpacity
                style={[styles.authToggleTab, authMode === 'LOGIN' && styles.authToggleTabActive]}
                onPress={() => setAuthMode('LOGIN')}
                activeOpacity={0.8}
              >
                <LogIn size={15} color={authMode === 'LOGIN' ? '#FFFFFF' : theme.colors.textSecondary} />
                <Text style={[styles.authToggleText, authMode === 'LOGIN' && styles.authToggleTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authToggleTab, authMode === 'REGISTER' && styles.authToggleTabActive]}
                onPress={() => setAuthMode('REGISTER')}
                activeOpacity={0.8}
              >
                <UserPlus size={15} color={authMode === 'REGISTER' ? '#FFFFFF' : theme.colors.textSecondary} />
                <Text style={[styles.authToggleText, authMode === 'REGISTER' && styles.authToggleTextActive]}>
                  Create User
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === 'LOGIN' ? (
              /* SIGN IN FORM (FIRST) */
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>USERNAME / USER ID</Text>
                <TextInput
                  placeholder="Enter your username"
                  value={username}
                  onChangeText={setUsername}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>PASSWORD</Text>
                <TextInput
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handlePasswordLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* CREATE USER FORM (FIRST) */
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>FULL NAME (ENGLISH) *</Text>
                <TextInput
                  placeholder="e.g. Master K. Saravanan"
                  value={fullNameEn}
                  onChangeText={setFullNameEn}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />

                <Text style={styles.inputLabel}>முழுப் பெயர் (தமிழ் - OPTIONAL)</Text>
                <TextInput
                  placeholder="எ.கா. மாஸ்டர் கே. சரவணன்"
                  value={fullNameTa}
                  onChangeText={setFullNameTa}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />

                <Text style={styles.inputLabel}>USERNAME *</Text>
                <TextInput
                  placeholder="Choose a username"
                  value={username}
                  onChangeText={setUsername}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>PASSWORD *</Text>
                <TextInput
                  placeholder="Create a password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.outline}
                  secureTextEntry
                />

                <Text style={styles.inputLabel}>YOUR ROLE *</Text>
                {isFirstAccount ? (
                  <View style={styles.firstAccountNote}>
                    <Text style={styles.firstAccountNoteText}>
                      This is the first account on this device, so it becomes the academy
                      Admin with full access.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.roleRow}>
                    {SIGNUP_ROLES.map(option => {
                      const isSelected = signupRole === option.role;
                      return (
                        <TouchableOpacity
                          key={option.role}
                          style={[styles.roleCard, isSelected && styles.roleCardActive]}
                          onPress={() => setSignupRole(option.role)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.roleCardIcon}>{option.icon}</Text>
                          <Text style={[styles.roleCardLabel, isSelected && styles.roleCardLabelActive]}>
                            {option.labelEn}
                          </Text>
                          <Text style={styles.roleCardTa}>{option.labelTa}</Text>
                          {isSelected && (
                            <View style={styles.roleCheck}>
                              <Check size={11} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#059669' }, loading && { opacity: 0.7 }]}
                  onPress={handleCreateAccount}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Create Account & Next</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Divider: OR */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Down: Continue with Google Button */}
            <TouchableOpacity
              style={[styles.googleSignInBtn, googleLoading && { opacity: 0.7 }]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#1E293B" style={{ marginRight: 10 }} />
              ) : (
                <View style={styles.googleIconBadge}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
              )}
              <View style={styles.googleBtnTextGroup}>
                <Text style={styles.googleBtnTitle}>
                  {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
                </Text>
                <Text style={styles.googleBtnSubtitle}>
                  1-Tap Fast & Secure Sign-In
                </Text>
              </View>
              <ArrowRight size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.secureRow}>
            <ShieldCheck size={16} color={theme.colors.accent} />
            <Text style={styles.secureText}>SQLite Offline-First Local Storage</Text>
          </View>
          <Text style={styles.copyright}>© 2026 Vagai Silambam Academy. Tamil Nadu, India.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginBottom: theme.spacing.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  brandTitleTa: {
    fontSize: 15,
    fontWeight: '800',
    color: '#047857',
    marginTop: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    width: '100%',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  authModeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    padding: 3,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  authToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 6,
    gap: 6,
  },
  authToggleTabActive: {
    backgroundColor: theme.colors.primary,
  },
  authToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  authToggleTextActive: {
    color: '#FFFFFF',
  },
  formContainer: {
    width: '100%',
  },
  roleRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  roleCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  roleCardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  roleCardLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textSecondary,
  },
  roleCardLabelActive: {
    color: theme.colors.primary,
  },
  roleCardTa: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstAccountNote: {
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.ring,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  firstAccountNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 46,
    marginBottom: theme.spacing.md,
    fontSize: 13,
  },
  outline: {
    borderRadius: 8,
    borderColor: theme.colors.border,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleGText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnTextGroup: {
    flex: 1,
  },
  googleBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  googleBtnSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  // Step 2 Styles
  step2Header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  roleIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  step2Title: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  step2Subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  roleOptionsList: {
    gap: 10,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
  },
  roleOptionCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  roleOptionIcon: {
    fontSize: 28,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleOptionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  roleOptionLabelActive: {
    color: theme.colors.primary,
  },
  selectedCheckBadge: {
    backgroundColor: theme.colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionDescription: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  backToAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingVertical: 6,
  },
  backToAuthText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: theme.spacing.xl,
    alignItems: 'center',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  copyright: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
});
