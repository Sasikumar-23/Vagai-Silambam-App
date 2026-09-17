import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, ActivityIndicator, Platform
} from 'react-native';
import { TextInput } from 'react-native-paper';
import {
  Globe, Database, Save, ArrowLeft,
  Shield, Check, Download, Upload, Info,
  FolderTree, ExternalLink, RefreshCw, Sparkles,
  LogOut, Edit3, X, Building2, Phone, Mail, MapPin, Hash, Receipt
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { GoogleDriveStorageService, GoogleDriveStatus } from '../services/GoogleDriveStorageService';
import { GoogleOAuthService } from '../services/GoogleOAuthService';
import { createDatabaseBackup, restoreDatabaseFromBackup, BackupData } from '../database/backup';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen({ navigation }: any) {
  const { t, language, setLanguage } = useI18n();

  // Organization Information state
  const [orgNameEn, setOrgNameEn] = useState('Vagai Silambam Academy');
  const [orgNameTa, setOrgNameTa] = useState('வாகை சிலம்பம் கழகம்');
  const [phone, setPhone] = useState('+91 98401 23456');
  const [email, setEmail] = useState('contact@vagaisilambam.in');
  const [addressEn, setAddressEn] = useState('No 14, Gandhi Salai, Velachery, Chennai, Tamil Nadu 600042');
  const [studentIdPrefix, setStudentIdPrefix] = useState('VS-2026-');
  const [receiptPrefix, setReceiptPrefix] = useState('VSP-2026-');
  const [isEditingOrg, setIsEditingOrg] = useState(false);

  // Google Drive Cloud Storage state
  const [driveEmail, setDriveEmail] = useState('admin@vagaisilambam.org');
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus>({ isConnected: false, rootFolderReady: false });
  const [testingDrive, setTestingDrive] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  const [savingOrg, setSavingOrg] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [all, gdrive] = await Promise.all([
        SettingsRepository.getAllSettings(),
        GoogleDriveStorageService.getStatus(),
      ]);

      if (all['org_name_en']) setOrgNameEn(all['org_name_en']);
      if (all['org_name_ta']) setOrgNameTa(all['org_name_ta']);
      if (all['phone']) setPhone(all['phone']);
      if (all['email']) setEmail(all['email']);
      if (all['address_en']) setAddressEn(all['address_en']);
      if (all['student_id_prefix']) setStudentIdPrefix(all['student_id_prefix']);
      if (all['receipt_prefix']) setReceiptPrefix(all['receipt_prefix']);

      setDriveStatus(gdrive);
      if (gdrive.userEmail) setDriveEmail(gdrive.userEmail);
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const handleSaveOrgSettings = async () => {
    setSavingOrg(true);
    try {
      await Promise.all([
        SettingsRepository.setSetting('org_name_en', orgNameEn.trim()),
        SettingsRepository.setSetting('org_name_ta', orgNameTa.trim()),
        SettingsRepository.setSetting('phone', phone.trim()),
        SettingsRepository.setSetting('email', email.trim()),
        SettingsRepository.setSetting('address_en', addressEn.trim()),
        SettingsRepository.setSetting('student_id_prefix', studentIdPrefix.trim()),
        SettingsRepository.setSetting('receipt_prefix', receiptPrefix.trim()),
      ]);

      setIsEditingOrg(false);
      Alert.alert('Saved', 'Organization details updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save organization settings.');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleGoogleOAuthSignIn = async () => {
    setSigningInGoogle(true);
    try {
      const res = await GoogleDriveStorageService.connectWithGoogleOAuth();
      const status = await GoogleDriveStorageService.getStatus();
      setDriveStatus(status);
      if (status.userEmail) setDriveEmail(status.userEmail);

      if (res.success) {
        Alert.alert('Google Drive Connected! 🌟', res.message);
      } else {
        Alert.alert('Notice', res.message || 'Google Sign-in was not completed.');
      }
    } catch (err: any) {
      Alert.alert('Google Sign-in Error', err.message || 'Could not complete Google Sign-in.');
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleTestDrive = async () => {
    setTestingDrive(true);
    try {
      const res = await GoogleDriveStorageService.testDriveConnection(driveEmail);
      const status = await GoogleDriveStorageService.getStatus();
      setDriveStatus(status);
      Alert.alert(res.success ? 'Drive Active' : 'Drive Test Note', res.message);
    } catch (err: any) {
      Alert.alert('Drive Test Error', err.message || 'Could not verify drive access.');
    } finally {
      setTestingDrive(false);
    }
  };

  const handleOpenDrive = async () => {
    try {
      await GoogleDriveStorageService.openDriveInBrowser();
    } catch (err: any) {
      Alert.alert('Error', 'Could not open Google Drive.');
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    await GoogleDriveStorageService.disconnectDrive();
    const status = await GoogleDriveStorageService.getStatus();
    setDriveStatus(status);
    Alert.alert('Disconnected', 'Google Drive disconnected from the app.');
  };

  const handleBackupDatabase = async () => {
    setBackingUp(true);
    try {
      const backupData: BackupData = await createDatabaseBackup();
      const backupJson = JSON.stringify(backupData, null, 2);
      const filename = `Vagai_Silambam_Backup_${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, backupJson, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Database Backup',
        });
      } else {
        Alert.alert('Backup Created', `Database backup generated: ${filename}`);
      }
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message || 'Error backing up database.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreDatabase = async () => {
    try {
      const docRes = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (docRes.canceled || !docRes.assets || docRes.assets.length === 0) {
        return;
      }

      const fileAsset = docRes.assets[0];
      setRestoring(true);

      const fileContent = await FileSystem.readAsStringAsync(fileAsset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseErr) {
        setRestoring(false);
        Alert.alert('Invalid File', 'The selected file is not a valid JSON database backup.');
        return;
      }

      Alert.alert(
        'Confirm Database Restore',
        `Restore database from "${fileAsset.name}"?\n\n⚠️ Warning: This will overwrite local student and attendance records with the backup file data.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setRestoring(false) },
          {
            text: 'Restore Now',
            style: 'destructive',
            onPress: async () => {
              try {
                const restoreResult = await restoreDatabaseFromBackup(parsedData);
                if (restoreResult.success) {
                  Alert.alert('Success', 'Database restored successfully from backup file!');
                  await loadSettings();
                } else {
                  Alert.alert('Restore Failed', restoreResult.message);
                }
              } catch (restoreErr: any) {
                Alert.alert('Restore Error', restoreErr.message || 'Could not restore database.');
              } finally {
                setRestoring(false);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      setRestoring(false);
      Alert.alert('Error', err.message || 'Failed to select backup file.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t.settings.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Language Selection Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Globe size={20} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>{t.settings.language}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Choose default system interface language (English or தமிழ்)
          </Text>

          <View style={styles.langBtnRow}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, language === 'ta' && styles.langBtnActive]}
              onPress={() => setLanguage('ta')}
            >
              <Text style={[styles.langBtnText, language === 'ta' && styles.langBtnTextActive]}>
                தமிழ் (Tamil)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Organization Settings with Clean View / Edit Mode */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <View style={styles.cardTitleRow}>
              <Building2 size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Organization Information</Text>
            </View>
            <TouchableOpacity
              style={[styles.editToggleBtn, isEditingOrg && styles.editToggleBtnActive]}
              onPress={() => setIsEditingOrg(!isEditingOrg)}
            >
              {isEditingOrg ? (
                <>
                  <X size={14} color="#DC2626" />
                  <Text style={[styles.editToggleText, { color: '#DC2626' }]}>Cancel</Text>
                </>
              ) : (
                <>
                  <Edit3 size={14} color={theme.colors.primary} />
                  <Text style={styles.editToggleText}>Edit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {isEditingOrg ? (
            /* EDIT MODE FORM */
            <View style={styles.orgForm}>
              <Text style={styles.fieldLabel}>Organization Name (English)</Text>
              <TextInput
                mode="outlined"
                value={orgNameEn}
                onChangeText={setOrgNameEn}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <Text style={styles.fieldLabel}>நிறுவனத்தின் பெயர் (தமிழ்)</Text>
              <TextInput
                mode="outlined"
                value={orgNameTa}
                onChangeText={setOrgNameTa}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <Text style={styles.fieldLabel}>Contact Phone</Text>
              <TextInput
                mode="outlined"
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                outlineStyle={styles.outline}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Contact Email</Text>
              <TextInput
                mode="outlined"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                outlineStyle={styles.outline}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Head Dojo Address</Text>
              <TextInput
                mode="outlined"
                value={addressEn}
                onChangeText={setAddressEn}
                multiline
                numberOfLines={2}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Student ID Prefix</Text>
                  <TextInput
                    mode="outlined"
                    value={studentIdPrefix}
                    onChangeText={setStudentIdPrefix}
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Receipt Prefix</Text>
                  <TextInput
                    mode="outlined"
                    value={receiptPrefix}
                    onChangeText={setReceiptPrefix}
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, savingOrg && { opacity: 0.6 }]}
                onPress={handleSaveOrgSettings}
                disabled={savingOrg}
              >
                <Save size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{savingOrg ? 'Saving...' : 'Save Organization Settings'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* VIEW SUMMARY MODE */
            <View style={styles.orgSummary}>
              <View style={styles.summaryItem}>
                <Building2 size={16} color={theme.colors.primary} style={styles.summaryIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Organization Name</Text>
                  <Text style={styles.summaryValue}>{orgNameEn}</Text>
                  <Text style={styles.summarySubValue}>{orgNameTa}</Text>
                </View>
              </View>

              <View style={styles.summaryItem}>
                <Phone size={16} color={theme.colors.accent} style={styles.summaryIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Phone</Text>
                  <Text style={styles.summaryValue}>{phone}</Text>
                </View>
              </View>

              <View style={styles.summaryItem}>
                <Mail size={16} color={theme.colors.primary} style={styles.summaryIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Email</Text>
                  <Text style={styles.summaryValue}>{email}</Text>
                </View>
              </View>

              <View style={styles.summaryItem}>
                <MapPin size={16} color={theme.colors.crimson} style={styles.summaryIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Address</Text>
                  <Text style={styles.summaryValue}>{addressEn}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Student ID Prefix</Text>
                  <Text style={styles.prefixBadge}>{studentIdPrefix}</Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Receipt Prefix</Text>
                  <Text style={styles.prefixBadge}>{receiptPrefix}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* GOOGLE DRIVE — 1-TAP SIGN IN WITH GOOGLE & CLOUD STORAGE */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <FolderTree size={20} color="#2563EB" />
            <Text style={styles.cardTitle}>Google Drive — Cloud Storage</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            1-Tap Google Sign-In connects your Google Drive. Photos, belt certificates, and attendance logs upload automatically to your cloud drive.
          </Text>

          {!driveStatus.isConnected ? (
            <View style={styles.oauthPromoContainer}>
              <TouchableOpacity
                style={[styles.googleSignInBtn, signingInGoogle && { opacity: 0.7 }]}
                onPress={handleGoogleOAuthSignIn}
                disabled={signingInGoogle}
              >
                {signingInGoogle ? (
                  <ActivityIndicator size="small" color="#1E293B" style={{ marginRight: 8 }} />
                ) : (
                  <View style={styles.googleIconBadge}>
                    <Text style={styles.googleGText}>G</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.googleSignInTitle}>
                    {signingInGoogle ? 'Connecting...' : 'Sign In with Google'}
                  </Text>
                  <Text style={styles.googleSignInSub}>
                    Auto-creates "Vagai Silambam" Cloud Folder
                  </Text>
                </View>
                <Sparkles size={18} color="#D97706" />
              </TouchableOpacity>

              <View style={styles.oauthNoteBox}>
                <Shield size={14} color="#059669" />
                <Text style={styles.oauthNoteText}>
                  Tap once, choose your Google account, and tap Allow. All student photos and documents sync to your Google Drive automatically.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.connectedProfileCard}>
              <View style={styles.connectedProfileTop}>
                {driveStatus.userPicture ? (
                  <Image source={{ uri: driveStatus.userPicture }} style={styles.userAvatarImg} />
                ) : (
                  <View style={styles.userAvatarFallback}>
                    <Text style={styles.userAvatarText}>
                      {(driveStatus.userName || driveStatus.userEmail || 'G')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.connectedBadgeRow}>
                    <Text style={styles.connectedProfileName}>
                      {driveStatus.userName || driveStatus.userEmail?.split('@')[0] || 'Silambam Master'}
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>✓ Connected</Text>
                    </View>
                  </View>
                  <Text style={styles.connectedProfileEmail}>{driveStatus.userEmail}</Text>
                  <Text style={styles.connectedDriveHint}>
                    Google Drive Cloud Storage Active
                  </Text>
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { flex: 1, backgroundColor: '#EFF6FF', borderColor: '#2563EB' }]}
                  onPress={handleOpenDrive}
                >
                  <ExternalLink size={14} color="#2563EB" />
                  <Text style={[styles.smallActionText, { color: '#2563EB' }]}>
                    Open Drive ↗
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallActionBtn, { flex: 1, backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}
                  onPress={handleTestDrive}
                  disabled={testingDrive}
                >
                  <RefreshCw size={14} color="#475569" />
                  <Text style={[styles.smallActionText, { color: '#475569' }]}>
                    {testingDrive ? 'Verifying...' : 'Test Sync'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', paddingHorizontal: 12 }]}
                  onPress={handleDisconnectGoogleDrive}
                >
                  <LogOut size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Folder Structure */}
          <View style={styles.folderStructureCard}>
            <View style={styles.folderStructHeader}>
              <FolderTree size={15} color="#2563EB" />
              <Text style={styles.folderStructTitle}>Cloud Folder Structure:</Text>
            </View>
            <Text style={styles.folderItem}>└── 📁 Vagai Silambam/</Text>
            <Text style={styles.folderSubItem}>    ├── 📊 Student Attendance/ (CSV snapshot logs)</Text>
            <Text style={styles.folderSubItem}>    ├── 📷 Student Photos/ (Full-res profile pictures)</Text>
            <Text style={styles.folderSubItem}>    ├── 📜 Certificates/ (Belt gradings & awards)</Text>
            <Text style={styles.folderSubItem}>    ├── 📄 Student Documents/ (Aadhaar, IDs, forms)</Text>
            <Text style={styles.folderSubItem}>    └── 🎪 Event Documents/ (Tournaments, camps)</Text>
          </View>
        </View>

        {/* SQLite Local Database — Backup & Restore */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Database size={20} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>{t.settings.databaseSection} (Local Database)</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Offline local relational storage for all student records, attendance, payments, uniforms, and events.
          </Text>

          <View style={styles.dbButtonsGrid}>
            <TouchableOpacity
              style={[styles.dbActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#2563EB' }]}
              onPress={handleBackupDatabase}
              disabled={backingUp}
            >
              <Download size={18} color="#2563EB" />
              <Text style={[styles.dbActionText, { color: '#2563EB' }]}>
                {backingUp ? 'Exporting Backup...' : 'Export Database Backup'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dbActionBtn, { backgroundColor: '#ECFDF5', borderColor: '#059669' }]}
              onPress={handleRestoreDatabase}
              disabled={restoring}
            >
              <Upload size={18} color="#059669" />
              <Text style={[styles.dbActionText, { color: '#059669' }]}>
                {restoring ? 'Restoring Database...' : 'Restore Database Backup'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Info size={18} color={theme.colors.textSecondary} />
            <Text style={styles.cardTitle}>{t.settings.about}</Text>
          </View>
          <Text style={styles.aboutText}>
            Vagai Silambam Student Management & Training Management Mobile Application.
            Engineered for Silambam martial arts organizations in Tamil Nadu, India.
          </Text>
          <Text style={styles.versionText}>{t.settings.version}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    backgroundColor: theme.colors.surface,
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 6,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 16,
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  editToggleBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  editToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  orgSummary: {
    gap: 12,
    marginTop: 4,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 10,
    borderRadius: theme.borderRadius.md,
  },
  summaryIcon: {
    marginTop: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  summarySubValue: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
    marginTop: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCol: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 10,
    borderRadius: theme.borderRadius.md,
  },
  prefixBadge: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 2,
  },
  orgForm: {
    marginTop: 8,
  },
  langBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  langBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  outline: {
    borderRadius: 8,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  oauthPromoContainer: {
    gap: 12,
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
    ...theme.shadows.sm,
  },
  googleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleGText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleSignInTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  googleSignInSub: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  oauthNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  oauthNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  connectedProfileCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  connectedProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  connectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectedProfileName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  connectedProfileEmail: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  connectedDriveHint: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionBtn: {
    height: 38,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  smallActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  folderStructureCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  folderStructHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  folderStructTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  folderItem: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
    fontWeight: '700',
  },
  folderSubItem: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748B',
  },
  dbButtonsGrid: {
    gap: 10,
  },
  dbActionBtn: {
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dbActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  aboutText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
