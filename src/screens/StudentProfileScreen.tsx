import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Linking, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Phone, Edit2, Award, Calendar, IndianRupee,
  Shirt, FileText, ChevronRight, Shield, ArrowLeft, User, Camera
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { StatusBadge } from '../components/StatusBadge';
import { StudentRepository } from '../repositories/StudentRepository';
import { AchievementRepository } from '../repositories/AchievementRepository';
import { CertificateRepository } from '../repositories/CertificateRepository';
import { FeeRepository } from '../repositories/FeeRepository';
import { EventRepository } from '../repositories/EventRepository';
import { Student, ParentGuardian, Achievement, Certificate } from '../models/types';
import { GoogleSheetsAttendanceService } from '../services/GoogleSheetsAttendanceService';
import { GoogleDriveStorageService } from '../services/GoogleDriveStorageService';

export default function StudentProfileScreen({ route, navigation }: any) {
  const { studentId } = route.params;
  const { t, language } = useI18n();

  const [student, setStudent] = useState<Student | null>(null);
  const [guardians, setGuardians] = useState<ParentGuardian[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [attendanceRate, setAttendanceRate] = useState(100);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PERSONAL' | 'GUARDIAN' | 'TRAINING' | 'ACHIEVEMENTS' | 'FEES'>('OVERVIEW');

  useEffect(() => {
    loadStudentDetails();
  }, [studentId]);

  const loadStudentDetails = async () => {
    try {
      const [stu, gList, achList, certList] = await Promise.all([
        StudentRepository.getStudentById(studentId),
        StudentRepository.getStudentGuardians(studentId),
        AchievementRepository.getStudentAchievements(studentId),
        CertificateRepository.getStudentCertificates(studentId),
      ]);

      setStudent(stu);
      setGuardians(gList);
      setAchievements(achList);
      setCertificates(certList);

      if (stu) {
        // Calculate dynamic attendance percentage directly from Google Sheets attendance logs
        const metrics = await GoogleSheetsAttendanceService.calculateStudentMetrics(stu.student_id);
        setAttendanceRate(metrics.percentage);
      }
    } catch (e) {
      console.error('Error loading student profile:', e);
    }
  };

  const handleUpdatePhotoUri = async (uri: string | null) => {
    try {
      let finalPhotoUrl = uri || undefined;
      if (uri && student) {
        const driveResult = await GoogleDriveStorageService.uploadStudentPhoto(student.student_id, uri);
        finalPhotoUrl = driveResult.photoUrl;
      }

      await StudentRepository.updateStudent(studentId, { photo_url: finalPhotoUrl });
      setStudent(prev => prev ? { ...prev, photo_url: finalPhotoUrl } : null);
      Alert.alert('Success', 'Student photo updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update photo.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUpdatePhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUpdatePhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open gallery.');
    }
  };

  const handlePhotoAction = () => {
    Alert.alert(
      'Update Student Photo / மாணவர் புகைப்படம்',
      'Choose an option:',
      [
        {
          text: '📷 Open Camera (புகைப்படம் எடு)',
          onPress: takePhotoWithCamera,
        },
        {
          text: '🖼️ Choose from Gallery (கேலரி)',
          onPress: chooseFromGallery,
        },
        ...(student?.photo_url
          ? [
              {
                text: '🗑️ Remove Photo',
                style: 'destructive' as const,
                onPress: () => handleUpdatePhotoUri(null),
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const handleCall = () => {
    if (student?.contact_number) {
      Linking.openURL(`tel:${student.contact_number.replace(/[^0-9+]/g, '')}`);
    }
  };

  if (!student) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'OVERVIEW', label: 'Overview' },
    { key: 'PERSONAL', label: 'Personal' },
    { key: 'GUARDIAN', label: 'Parent' },
    { key: 'TRAINING', label: 'Training' },
    { key: 'ACHIEVEMENTS', label: 'Awards' },
  ];

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Practitioner Profile</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => Alert.alert('Edit Student', 'To modify student details, updates are performed directly.')}
        >
          <Edit2 size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <TouchableOpacity
              onPress={handlePhotoAction}
              activeOpacity={0.7}
              style={styles.avatarContainer}
            >
              {student.photo_url ? (
                <Image source={{ uri: student.photo_url }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.profileFallback}>
                  <Text style={styles.fallbackInitial}>
                    {student.name_en ? student.name_en.charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Camera size={13} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.mainInfo}>
              <View style={styles.nameHeaderRow}>
                <Text style={styles.studentNameEn} numberOfLines={1}>
                  {student.name_en}
                </Text>
                <StatusBadge status={student.student_status} size="small" />
              </View>

              {student.name_ta && (
                <Text style={styles.studentNameTa}>{student.name_ta}</Text>
              )}

              <Text style={styles.studentCodeBadge}>{student.student_id}</Text>

              <View style={styles.levelBadgeRow}>
                <Award size={14} color={theme.colors.gold} />
                <Text style={styles.levelBadgeText}>
                  {student.training_level} Silambam
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Photo & Call Buttons Row */}
          <View style={styles.profileActionsRow}>
            <TouchableOpacity style={styles.photoQuickBtn} onPress={takePhotoWithCamera}>
              <Camera size={14} color={theme.colors.primary} />
              <Text style={styles.photoQuickBtnText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoQuickBtn} onPress={chooseFromGallery}>
              <FileText size={14} color={theme.colors.primary} />
              <Text style={styles.photoQuickBtnText}>Gallery</Text>
            </TouchableOpacity>

            {student.contact_number && (
              <TouchableOpacity style={styles.callActionButton} onPress={handleCall}>
                <Phone size={14} color="#FFFFFF" />
                <Text style={styles.callActionText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: attendanceRate >= 75 ? theme.colors.accent : theme.colors.crimson }]}>
              {attendanceRate}%
            </Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.gold }]}>
              {achievements.length}
            </Text>
            <Text style={styles.statLabel}>Awards</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.purple }]}>
              {certificates.length}
            </Text>
            <Text style={styles.statLabel}>Certificates</Text>
          </View>
        </View>

        {/* Horizontal Navigation Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {tabs.map(tabItem => (
            <TouchableOpacity
              key={tabItem.key}
              style={[styles.tabButton, activeTab === tabItem.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tabItem.key)}
            >
              <Text style={[styles.tabButtonText, activeTab === tabItem.key && styles.tabButtonTextActive]}>
                {tabItem.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* TAB CONTENT: Overview */}
        {activeTab === 'OVERVIEW' && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeader}>Training & Center Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Joining Date</Text>
              <Text style={styles.infoVal}>{student.joining_date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Gender</Text>
              <Text style={styles.infoVal}>{student.gender}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Date of Birth</Text>
              <Text style={styles.infoVal}>{student.date_of_birth}</Text>
            </View>
            {student.medical_notes && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesKey}>Medical Notes:</Text>
                <Text style={styles.notesVal}>{student.medical_notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB CONTENT: Personal */}
        {activeTab === 'PERSONAL' && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeader}>Personal & Address Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Full Name (EN)</Text>
              <Text style={styles.infoVal}>{student.name_en}</Text>
            </View>
            {student.name_ta && (
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>முழுப் பெயர் (TA)</Text>
                <Text style={styles.infoVal}>{student.name_ta}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Phone</Text>
              <Text style={styles.infoVal}>{student.contact_number}</Text>
            </View>
            {student.address_en && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesKey}>Address (English):</Text>
                <Text style={styles.notesVal}>{student.address_en}</Text>
              </View>
            )}
            {student.address_ta && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesKey}>முகவரி (தமிழ்):</Text>
                <Text style={styles.notesVal}>{student.address_ta}</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB CONTENT: Guardian */}
        {activeTab === 'GUARDIAN' && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeader}>Parent / Guardian Details</Text>
            {guardians.length > 0 ? (
              guardians.map((g, idx) => (
                <View key={g.id || idx} style={styles.guardianItem}>
                  <Text style={styles.guardianName}>
                    {g.name_en} {g.name_ta ? `(${g.name_ta})` : ''}
                  </Text>
                  <Text style={styles.guardianRelation}>{g.relationship}</Text>
                  <TouchableOpacity
                    style={styles.guardianPhoneRow}
                    onPress={() => Linking.openURL(`tel:${g.phone}`)}
                  >
                    <Phone size={14} color={theme.colors.primary} />
                    <Text style={styles.guardianPhoneText}>{g.phone}</Text>
                  </TouchableOpacity>
                  {g.email && <Text style={styles.guardianEmail}>{g.email}</Text>}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No guardian details registered.</Text>
            )}
          </View>
        )}

        {/* TAB CONTENT: Training */}
        {activeTab === 'TRAINING' && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeader}>Silambam Martial Arts Status</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Current Rank / Level</Text>
              <Text style={[styles.infoVal, { fontWeight: '900', color: theme.colors.primary }]}>
                {student.training_level}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Status</Text>
              <Text style={styles.infoVal}>{student.student_status}</Text>
            </View>
            {student.previous_silambam_experience && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesKey}>Prior Experience:</Text>
                <Text style={styles.notesVal}>{student.previous_silambam_experience}</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB CONTENT: Achievements & Awards */}
        {activeTab === 'ACHIEVEMENTS' && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeader}>Medals & Recognitions</Text>
            {achievements.length > 0 ? (
              achievements.map((a, idx) => (
                <View key={a.id || idx} style={styles.awardItem}>
                  <Award size={20} color={theme.colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.awardTitle}>{a.title_en}</Text>
                    {a.title_ta && <Text style={styles.awardTitleTa}>{a.title_ta}</Text>}
                    <Text style={styles.awardDate}>{a.achievement_date} • {a.position || 'Award'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No tournament achievements recorded yet.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  editBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profilePhoto: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  profileFallback: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitial: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  mainInfo: {
    flex: 1,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  studentNameEn: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  studentNameTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
  },
  studentCodeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 4,
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.gold,
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  photoQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 76, 129, 0.15)',
  },
  photoQuickBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  callActionButton: {
    flex: 1.2,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: theme.borderRadius.md,
    gap: 6,
  },
  callActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  detailsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceSubtle,
  },
  infoKey: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  notesBlock: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  notesKey: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  notesVal: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  guardianItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceSubtle,
  },
  guardianName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  guardianRelation: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  guardianPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  guardianPhoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  guardianEmail: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  awardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceSubtle,
  },
  awardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  awardTitleTa: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  awardDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
