import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Platform, KeyboardAvoidingView, TouchableOpacity, Alert } from 'react-native';
import { TextInput, Button, Text, Surface, useTheme, Card, Divider } from 'react-native-paper';
import { ArrowLeft, Save, ShieldAlert, Code, ClipboardCheck as ClipboardCheckIcon, HelpCircle, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { driveSync } from '../utils/driveSync';

export default function SettingsScreen({ navigation }: any) {
  const [scriptUrl, setScriptUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const url = await driveSync.getScriptUrl();
    if (url) {
      setScriptUrl(url);
    }
  };

  const handleSave = async () => {
    if (scriptUrl.trim() && !scriptUrl.trim().startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP/HTTPS URL.');
      return;
    }
    setSaving(true);
    try {
      await driveSync.saveScriptUrl(scriptUrl.trim());
      Alert.alert('Success', 'Google Drive script URL saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      Alert.alert('Error', 'Please enter and save a Web App URL first.');
      return;
    }
    setTesting(true);
    try {
      const result = await driveSync.syncToGoogleDrive(
        'TEST_CONNECTION',
        [{ id: '1', name: 'Test Student', dob: '2000-01-01', gender: 'Male', contact: '123' }],
        { '1': 'Present' },
        scriptUrl.trim()
      );

      if (result && result.success) {
        Alert.alert('Success', 'Connected successfully! Test record uploaded to Vagai Silambam folder in Google Drive.');
      } else {
        Alert.alert('Connection Failed', result.error || 'Server returned failure status.');
      }
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Check your URL or Google deployment settings.');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyCode = async () => {
    const code = driveSync.getAppsScriptTemplateCode();
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Copied', 'Apps Script code template copied to clipboard.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#1A3673" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Drive Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cloud Synchronization</Text>
        <Text style={styles.subtitle}>
          Save and sync your attendance records directly to Google Sheets using Google Apps Script.
        </Text>

        <Surface style={styles.formCard} elevation={1}>
          <Text style={styles.sectionHeader}>API CONFIGURATION</Text>
          <Text style={styles.inputLabel}>Google Web App URL</Text>
          <TextInput
            placeholder="https://script.google.com/macros/s/.../exec"
            value={scriptUrl}
            onChangeText={setScriptUrl}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.outline}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.actionButtonsRow}>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              style={[styles.button, styles.saveButton]}
              labelStyle={styles.buttonLabel}
            >
              <View style={styles.btnInner}>
                <Save color="#fff" size={16} />
                <Text style={styles.btnText}>Save URL</Text>
              </View>
            </Button>

            <Button
              mode="outlined"
              onPress={handleTestConnection}
              loading={testing}
              style={[styles.button, styles.testButton]}
              textColor="#1A3673"
            >
              <View style={styles.btnInner}>
                <RefreshCw color="#1A3673" size={16} />
                <Text style={[styles.btnText, { color: '#1A3673' }]}>Test Sync</Text>
              </View>
            </Button>
          </View>
        </Surface>

        <Card style={styles.instructionsCard}>
          <Card.Content>
            <View style={styles.instructionsTitleRow}>
              <HelpCircle color="#1A3673" size={20} />
              <Text style={styles.instructionsTitle}>Setup Instructions</Text>
            </View>
            <Divider style={styles.divider} />
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Open Google Sheets and create a new sheet.</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Click <Text style={{ fontWeight: 'bold' }}>Extensions &gt; Apps Script</Text>.</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Delete all code and paste the custom template code.</Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                Click <Text style={{ fontWeight: 'bold' }}>Deploy &gt; New deployment</Text>.
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>5</Text>
              <Text style={styles.stepText}>
                Select <Text style={{ fontWeight: 'bold' }}>Web app</Text>, execute as <Text style={{ fontWeight: 'bold' }}>Me</Text>, and set access to <Text style={{ fontWeight: 'bold' }}>Anyone</Text>.
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>6</Text>
              <Text style={styles.stepText}>Deploy, copy the Web App URL, and paste it here.</Text>
            </View>

            <Button
              mode="contained"
              onPress={handleCopyCode}
              style={styles.copyCodeButton}
              buttonColor="#EBF2FF"
              textColor="#1A3673"
            >
              <View style={styles.btnInner}>
                {copied ? <ClipboardCheckIcon color="#1A3673" size={18} /> : <Code color="#1A3673" size={18} />}
                <Text style={[styles.btnText, { color: '#1A3673' }]}>
                  {copied ? 'Copied to Clipboard!' : 'Copy Apps Script Code'}
                </Text>
              </View>
            </Button>
          </Card.Content>
        </Card>

        <Surface style={styles.securityWarningCard} elevation={1}>
          <ShieldAlert color="#C58C00" size={20} />
          <Text style={styles.securityText}>
            Security Note: Set your deployment access to 'Anyone' so the mobile app can connect without Google developer client keys. All requests are processed securely using your private script.
          </Text>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#F5F7FB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A3673',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A3673',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A3673',
    letterSpacing: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A3673',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    height: 50,
    marginBottom: 20,
  },
  outline: {
    borderRadius: 8,
    borderColor: '#E5E9F0',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 10,
  },
  saveButton: {
    backgroundColor: '#1A3673',
  },
  testButton: {
    borderColor: '#1A3673',
    borderWidth: 1.5,
  },
  buttonLabel: {
    color: '#fff',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderColor: '#E5E9F0',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 24,
  },
  instructionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A3673',
  },
  divider: {
    marginBottom: 16,
    backgroundColor: '#E5E9F0',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  stepNumber: {
    backgroundColor: '#EBF2FF',
    color: '#1A3673',
    fontWeight: '900',
    fontSize: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  copyCodeButton: {
    marginTop: 8,
    borderRadius: 10,
    height: 48,
  },
  securityWarningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 12,
    padding: 16,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#B26A00',
    lineHeight: 18,
    fontWeight: '600',
  },
});
