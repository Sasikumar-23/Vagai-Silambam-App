import React, { useState } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme } from 'react-native-paper';
import { ArrowRight, HelpCircle, ShieldCheck } from 'lucide-react-native';
import { storage } from '../utils/storage';

export default function LoginScreen({ navigation }: any) {
  const [institutionId, setInstitutionId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleLogin = async () => {
    if (!institutionId || !password) return;
    setLoading(true);
    await storage.login(institutionId);
    setLoading(false);
    navigation.replace('MainTabs');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Vagai Silambam</Text>
          <Text style={styles.subtitle}>Professional Attendance Management</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>INSTITUTION ID</Text>
          <TextInput
            placeholder="Enter ID"
            value={institutionId}
            onChangeText={setInstitutionId}
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

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            style={styles.continueButton}
            contentStyle={styles.continueButtonContent}
            labelStyle={styles.continueButtonLabel}
          >
            <View style={styles.buttonInner}>
              <Text style={styles.buttonText}>Continue</Text>
              <ArrowRight color="#fff" size={20} />
            </View>
          </Button>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>AUTHORIZED ACCESS</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.supportButton}>
            <HelpCircle color="#1A3673" size={20} />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.linkText}>Terms of Service</Text> and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>.
          </Text>
          <View style={styles.secureContainer}>
            <ShieldCheck color="#666" size={16} />
            <Text style={styles.secureText}>Secure Institutional Login</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#1A3673',
    padding: 15,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A3673',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A3673',
    letterSpacing: 1,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    marginBottom: 20,
    height: 54,
  },
  outline: {
    borderRadius: 8,
    borderColor: '#E5E9F0',
    borderWidth: 1,
  },
  continueButton: {
    backgroundColor: '#1A3673',
    borderRadius: 8,
    marginBottom: 32,
  },
  continueButtonContent: {
    height: 54,
  },
  continueButtonLabel: {
    color: '#fff',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E9F0',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#999',
    marginHorizontal: 12,
    letterSpacing: 1,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    gap: 8,
  },
  supportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3673',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  linkText: {
    color: '#1A3673',
    fontWeight: '700',
  },
  secureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secureText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
