import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { format } from 'date-fns';
import {
  Calendar, Check, CheckCheck, Clock, X,
  AlertCircle, ArrowLeft, Send, Shield, Database, Cloud
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { StudentRepository } from '../repositories/StudentRepository';
import { GoogleSheetsAttendanceService, SheetAttendanceRecord } from '../services/GoogleSheetsAttendanceService';
import { GoogleDriveStorageService } from '../services/GoogleDriveStorageService';
import { TrainingCenterRepository } from '../repositories/TrainingCenterRepository';
import { Student, TrainingCenter, Instructor, AttendanceStatus } from '../models/types';

export default function TakeAttendanceScreen({ navigation }: any) {
  const { t, language } = useI18n();
  const { currentUser } = useAuth();

  const [centers, setCenters] = useState<TrainingCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionName, setSessionName] = useState<string>('Morning Batch (6:00 - 8:00 AM)');

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [remarksState, setRemarksState] = useState<Record<string, string>>({});
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    initAttendanceWorkflow();
  }, []);

  useEffect(() => {
    if (selectedCenterId) {
      loadCenterStudents(selectedCenterId);
    }
  }, [selectedCenterId, sessionDate, sessionName]);

  const initAttendanceWorkflow = async () => {
    setLoading(true);
    try {
      const [tcList, syncCount] = await Promise.all([
        TrainingCenterRepository.getAllCenters(),
        GoogleSheetsAttendanceService.getPendingSyncCount(),
      ]);
      setCenters(tcList);
      setPendingSyncCount(syncCount);
      if (tcList.length > 0) {
        const initialCenter = tcList[0];
        setSelectedCenterId(initialCenter.id);
        const instList = await TrainingCenterRepository.getAllInstructors(initialCenter.id);
        setInstructors(instList);
        if (instList.length > 0) setSelectedInstructorId(instList[0].id);
      }
    } catch (e) {
      console.error('Failed to init centers:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCenterStudents = async (centerId: string) => {
    setLoading(true);
    try {
      // 1. Fetch active students for this center from SQLite
      const stuList = await StudentRepository.getAllStudents({
        trainingCenterId: centerId,
        status: 'ACTIVE',
      });
      setStudents(stuList);

      // 2. Load existing attendance from Google Sheets / Attendance Engine for this date
      const existingDateRecords = await GoogleSheetsAttendanceService.getAttendanceForDate(sessionDate);
      const initialMap: Record<string, AttendanceStatus> = {};
      const initialRemarks: Record<string, string> = {};

      stuList.forEach(s => {
        const record = existingDateRecords[s.student_id];
        if (record) {
          const mapStatus: AttendanceStatus =
            record.status === 'Present' ? 'PRESENT' :
            record.status === 'Absent' ? 'ABSENT' :
            record.status === 'Late' ? 'LATE' : 'LEAVE';
          initialMap[s.id] = mapStatus;
          if (record.remarks) initialRemarks[s.id] = record.remarks;
        } else {
          // Default to PRESENT for ultra-fast workflow
          initialMap[s.id] = 'PRESENT';
        }
      });

      setAttendanceState(initialMap);
      setRemarksState(initialRemarks);
    } catch (e) {
      console.error('Failed to load attendance session:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      updated[s.id] = 'PRESENT';
    });
    setAttendanceState(updated);
  };

  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      Alert.alert('No Students', 'No active students found in this center.');
      return;
    }
    setSaving(true);
    try {
      // Transform records for Google Sheets Attendance (attendance_id, date, student_id, student_name, status, remarks, marked_by)
      const sheetPayload = students.map(s => {
        const rawStatus = attendanceState[s.id] || 'PRESENT';
        const sheetStatus: 'Present' | 'Absent' | 'Late' | 'Leave' =
          rawStatus === 'PRESENT' ? 'Present' :
          rawStatus === 'ABSENT' ? 'Absent' :
          rawStatus === 'LATE' ? 'Late' : 'Leave';

        return {
          student_id: s.student_id,
          student_name: s.name_en,
          date: sessionDate,
          status: sheetStatus,
          remarks: remarksState[s.id] || undefined,
          marked_by: currentUser?.full_name_en || 'Instructor',
        };
      });

      const [result] = await Promise.all([
        GoogleSheetsAttendanceService.saveAttendanceBatch(
          sheetPayload,
          currentUser?.full_name_en || 'Instructor'
        ),
        GoogleDriveStorageService.saveAttendanceReportToDrive(
          sessionDate,
          sheetPayload
        ),
      ]);

      const syncCount = await GoogleSheetsAttendanceService.getPendingSyncCount();
      setPendingSyncCount(syncCount);

      Alert.alert(
        '📊 Attendance Saved to Google Sheets & Drive',
        `${sheetPayload.length} Silambam practitioners recorded for ${sessionDate}.\n\n` +
        `• New Entries: ${result.savedCount}\n` +
        `• Updated: ${result.updatedCount}\n` +
        `• Stored in: Google Sheets + Drive (Student Attendance)\n` +
        (result.syncedToGoogle ? '☁️ Synced to Google Cloud.' : '⚡ Saved locally (will sync when online).'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save attendance to Google Sheets & Drive.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setLoading(true);
    const res = await GoogleSheetsAttendanceService.syncPendingQueue();
    const count = await GoogleSheetsAttendanceService.getPendingSyncCount();
    setPendingSyncCount(count);
    setLoading(false);
    if (res.success) {
      Alert.alert('Synced', `Successfully synced ${res.syncedCount} records to Google Sheets!`);
    } else {
      Alert.alert('Sync Note', res.error || 'Could not reach Google Sheets endpoint. Stored safely in local queue.');
    }
  };

  // Summary counts
  const totalCount = students.length;
  const presentCount = Object.values(attendanceState).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceState).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceState).filter(s => s === 'LATE').length;
  const leaveCount = Object.values(attendanceState).filter(s => s === 'LEAVE').length;

  const sessionOptions = [
    'Morning Batch (6:00 - 8:00 AM)',
    'Evening Batch (5:30 - 7:30 PM)',
    'Weekend Intensive (7:00 - 10:00 AM)',
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t.attendance.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Google Sheets Engine Header Pill */}
      <View style={styles.sheetEngineBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Cloud size={14} color="#047857" />
          <Text style={styles.sheetEngineText}>Google Sheets Database • Vagai Attendance</Text>
        </View>
        {pendingSyncCount > 0 && (
          <TouchableOpacity style={styles.syncPill} onPress={handleSyncNow}>
            <Text style={styles.syncPillText}>Sync ({pendingSyncCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      <OfflineBanner />

      {/* Selectors Bar */}
      <View style={styles.selectorsCard}>
        {/* Centers Horizontal Chips - only show if more than one center */}
        {centers.length > 1 && (
          <>
            <Text style={styles.selectorLabel}>{t.attendance.selectCenter}:</Text>
            <View style={styles.chipsRow}>
              {centers.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.centerChip, selectedCenterId === c.id && styles.centerChipActive]}
                  onPress={() => setSelectedCenterId(c.id)}
                >
                  <Text style={[styles.centerChipText, selectedCenterId === c.id && styles.centerChipTextActive]}>
                    {language === 'ta' && c.name_ta ? c.name_ta : c.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Single center name display when only one center */}
        {centers.length === 1 && (
          <View style={styles.singleCenterRow}>
            <Shield size={13} color={theme.colors.primary} />
            <Text style={styles.singleCenterText}>
              {language === 'ta' && centers[0]?.name_ta ? centers[0].name_ta : centers[0]?.name_en}
            </Text>
          </View>
        )}

        {/* Sessions & Fast "Mark All Present" Action */}
        <View style={styles.sessionRow}>
          <View style={styles.dateBlock}>
            <Calendar size={14} color={theme.colors.primary} />
            <Text style={styles.dateText}>{sessionDate}</Text>
          </View>

          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllPresent}>
            <CheckCheck size={16} color="#FFFFFF" />
            <Text style={styles.markAllBtnText}>{t.attendance.markAllPresent}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Student Attendance List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const currentStatus = attendanceState[item.id] || 'PRESENT';
            return (
              <View style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name_en ? item.name_en.charAt(0).toUpperCase() : 'S'}
                    </Text>
                  </View>
                  <View style={styles.studentDetails}>
                    <Text style={styles.nameEn} numberOfLines={1}>
                      {item.name_en}
                    </Text>
                    {item.name_ta && (
                      <Text style={styles.nameTa} numberOfLines={1}>
                        {item.name_ta}
                      </Text>
                    )}
                    <Text style={styles.metaText}>
                      {item.student_id} • {item.training_level}
                    </Text>
                  </View>
                </View>

                {/* 4 Large Touch Buttons (Present, Absent, Late, Leave) */}
                <View style={styles.statusButtonsGroup}>
                  {/* PRESENT */}
                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      styles.presentBtn,
                      currentStatus === 'PRESENT' && styles.presentBtnActive,
                    ]}
                    onPress={() => handleSetStatus(item.id, 'PRESENT')}
                    activeOpacity={0.7}
                  >
                    <Check
                      size={14}
                      color={currentStatus === 'PRESENT' ? '#FFFFFF' : theme.colors.accent}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        { color: currentStatus === 'PRESENT' ? '#FFFFFF' : theme.colors.accent },
                      ]}
                    >
                      {t.attendance.present}
                    </Text>
                  </TouchableOpacity>

                  {/* ABSENT */}
                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      styles.absentBtn,
                      currentStatus === 'ABSENT' && styles.absentBtnActive,
                    ]}
                    onPress={() => handleSetStatus(item.id, 'ABSENT')}
                    activeOpacity={0.7}
                  >
                    <X
                      size={14}
                      color={currentStatus === 'ABSENT' ? '#FFFFFF' : theme.colors.crimson}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        { color: currentStatus === 'ABSENT' ? '#FFFFFF' : theme.colors.crimson },
                      ]}
                    >
                      {t.attendance.absent}
                    </Text>
                  </TouchableOpacity>

                  {/* LATE */}
                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      styles.lateBtn,
                      currentStatus === 'LATE' && styles.lateBtnActive,
                    ]}
                    onPress={() => handleSetStatus(item.id, 'LATE')}
                    activeOpacity={0.7}
                  >
                    <Clock
                      size={14}
                      color={currentStatus === 'LATE' ? '#FFFFFF' : theme.colors.gold}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        { color: currentStatus === 'LATE' ? '#FFFFFF' : theme.colors.gold },
                      ]}
                    >
                      {t.attendance.late}
                    </Text>
                  </TouchableOpacity>

                  {/* LEAVE */}
                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      styles.leaveBtn,
                      currentStatus === 'LEAVE' && styles.leaveBtnActive,
                    ]}
                    onPress={() => handleSetStatus(item.id, 'LEAVE')}
                    activeOpacity={0.7}
                  >
                    <AlertCircle
                      size={14}
                      color={currentStatus === 'LEAVE' ? '#FFFFFF' : theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.statusBtnText,
                        { color: currentStatus === 'LEAVE' ? '#FFFFFF' : theme.colors.textMuted },
                      ]}
                    >
                      {t.attendance.leave}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Sticky Bottom Actions & Summary */}
      <View style={styles.footerContainer}>
        <View style={styles.summaryStatsRow}>
          <Text style={styles.totalBadgeText}>
            {totalCount} Students
          </Text>
          <View style={styles.countsGroup}>
            <Text style={[styles.countPill, { color: theme.colors.accent }]}>
              P: {presentCount}
            </Text>
            <Text style={[styles.countPill, { color: theme.colors.crimson }]}>
              A: {absentCount}
            </Text>
            <Text style={[styles.countPill, { color: theme.colors.gold }]}>
              L: {lateCount}
            </Text>
            <Text style={[styles.countPill, { color: theme.colors.textMuted }]}>
              Lv: {leaveCount}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveAttendanceBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveAttendance}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Send size={18} color="#FFFFFF" />
              <Text style={styles.saveAttendanceText}>
                {t.attendance.saveAttendance}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    color: theme.colors.primary,
  },
  selectorsCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  singleCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  singleCenterText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  centerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  centerChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  centerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  centerChipTextActive: {
    color: '#FFFFFF',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  markAllBtn: {
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  markAllBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  studentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  studentDetails: {
    flex: 1,
  },
  nameEn: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  nameTa: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusButtonsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    flex: 1,
    height: 46, // Minimum 44-48px touch target
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  presentBtn: {
    borderColor: theme.colors.accent,
    backgroundColor: '#E6F9F1',
  },
  presentBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  absentBtn: {
    borderColor: theme.colors.crimson,
    backgroundColor: '#FFE4E6',
  },
  absentBtnActive: {
    backgroundColor: theme.colors.crimson,
  },
  lateBtn: {
    borderColor: theme.colors.gold,
    backgroundColor: '#FEF3C7',
  },
  lateBtnActive: {
    backgroundColor: theme.colors.gold,
  },
  leaveBtn: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  leaveBtnActive: {
    backgroundColor: '#64748B',
    borderColor: '#64748B',
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  totalBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  countsGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  countPill: {
    fontSize: 12,
    fontWeight: '800',
  },
  saveAttendanceBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveAttendanceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetEngineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  sheetEngineText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  syncPill: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  syncPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
