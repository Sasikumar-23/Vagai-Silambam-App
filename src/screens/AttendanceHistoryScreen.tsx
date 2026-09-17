import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  BackHandler,
  ScrollView,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Calendar,
  Clock,
  User,
  ChevronRight,
  ArrowLeft,
  Search,
  ClipboardCheck,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Percent,
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { GoogleSheetsAttendanceService, SheetAttendanceRecord } from '../services/GoogleSheetsAttendanceService';

export interface AttendanceSessionGroup {
  sessionId: string;
  date: string;
  time: string;
  markedBy: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  records: SheetAttendanceRecord[];
}

export default function AttendanceHistoryScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();

  const [rawRecords, setRawRecords] = useState<SheetAttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drill-down detail state
  const [selectedSession, setSelectedSession] = useState<AttendanceSessionGroup | null>(null);
  const [detailFilter, setDetailFilter] = useState<'ALL' | 'Present' | 'Absent' | 'Late' | 'Leave'>('ALL');
  const [detailSearch, setDetailSearch] = useState('');

  useEffect(() => {
    if (isFocused) {
      loadHistory();
    }
  }, [isFocused]);

  // Handle hardware back press on Android to return from detail view to session list
  useEffect(() => {
    const onBackPress = () => {
      if (selectedSession) {
        setSelectedSession(null);
        setDetailSearch('');
        setDetailFilter('ALL');
        return true; // handled
      }
      return false; // let default back handle
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedSession]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await GoogleSheetsAttendanceService.getAllLocalRecords();
      setRawRecords(records);

      // Group records into Sessions by date and created_at
      const sessionMap: { [key: string]: SheetAttendanceRecord[] } = {};

      records.forEach(r => {
        // Group key based on date and time session
        const timeKey = r.created_at || '00:00';
        const key = `${r.date}___${timeKey}`;
        if (!sessionMap[key]) {
          sessionMap[key] = [];
        }
        sessionMap[key].push(r);
      });

      const sessionList: AttendanceSessionGroup[] = Object.keys(sessionMap).map(key => {
        const groupRecords = sessionMap[key];
        const [date, time] = key.split('___');
        const total = groupRecords.length;
        const present = groupRecords.filter(r => r.status === 'Present').length;
        const absent = groupRecords.filter(r => r.status === 'Absent').length;
        const late = groupRecords.filter(r => r.status === 'Late').length;
        const leave = groupRecords.filter(r => r.status === 'Leave').length;
        const markedBy = groupRecords[0]?.marked_by || 'Instructor';
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        return {
          sessionId: key,
          date,
          time: time === '00:00' ? '' : time,
          markedBy,
          totalStudents: total,
          presentCount: present,
          absentCount: absent,
          lateCount: late,
          leaveCount: leave,
          attendanceRate: rate,
          records: groupRecords,
        };
      });

      // Sort newest sessions first
      sessionList.sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.time.localeCompare(a.time);
      });

      setSessions(sessionList);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter sessions by search query (Date or MarkedBy)
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter(
      s =>
        s.date.toLowerCase().includes(q) ||
        s.markedBy.toLowerCase().includes(q) ||
        s.time.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Filter student records inside the selected session
  const filteredDetailRecords = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.records.filter(r => {
      const matchesFilter = detailFilter === 'ALL' || r.status === detailFilter;
      const matchesSearch =
        !detailSearch.trim() ||
        r.student_name.toLowerCase().includes(detailSearch.toLowerCase().trim()) ||
        r.student_id.toLowerCase().includes(detailSearch.toLowerCase().trim());
      return matchesFilter && matchesSearch;
    });
  }, [selectedSession, detailFilter, detailSearch]);

  // Render Single Session Card (Touch to view all students)
  const renderSessionCard = ({ item }: { item: AttendanceSessionGroup }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.sessionCard}
        onPress={() => {
          setSelectedSession(item);
          setDetailSearch('');
          setDetailFilter('ALL');
        }}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.dateTimeBadge}>
            <Calendar size={14} color={theme.colors.primary} />
            <Text style={styles.sessionDateText}>{item.date}</Text>
            {item.time ? (
              <>
                <Text style={styles.dotSeparator}>•</Text>
                <Clock size={13} color={theme.colors.textMuted} />
                <Text style={styles.sessionTimeText}>{item.time}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.ratePill}>
            <Percent size={11} color="#065F46" />
            <Text style={styles.ratePillText}>{item.attendanceRate}%</Text>
          </View>
        </View>

        <View style={styles.cardMiddleRow}>
          <View style={styles.sessionMetaInfo}>
            <View style={styles.studentCountRow}>
              <Users size={14} color={theme.colors.textPrimary} />
              <Text style={styles.studentCountText}>
                {item.totalStudents} {item.totalStudents === 1 ? 'Student' : 'Students'} Marked
              </Text>
            </View>
            <Text style={styles.instructorText}>
              Marked by <Text style={styles.instructorBold}>{item.markedBy}</Text>
            </Text>
          </View>
          <View style={styles.arrowIconContainer}>
            <Text style={styles.touchToViewText}>View</Text>
            <ChevronRight size={18} color={theme.colors.primary} />
          </View>
        </View>

        {/* Status Count Pills */}
        <View style={styles.statusChipsContainer}>
          <View style={[styles.miniChip, styles.miniChipPresent]}>
            <CheckCircle2 size={12} color="#065F46" />
            <Text style={styles.miniChipPresentText}>Present: {item.presentCount}</Text>
          </View>
          {item.absentCount > 0 && (
            <View style={[styles.miniChip, styles.miniChipAbsent]}>
              <XCircle size={12} color="#991B1B" />
              <Text style={styles.miniChipAbsentText}>Absent: {item.absentCount}</Text>
            </View>
          )}
          {item.lateCount > 0 && (
            <View style={[styles.miniChip, styles.miniChipLate]}>
              <AlertCircle size={12} color="#92400E" />
              <Text style={styles.miniChipLateText}>Late: {item.lateCount}</Text>
            </View>
          )}
          {item.leaveCount > 0 && (
            <View style={[styles.miniChip, styles.miniChipLeave]}>
              <Text style={styles.miniChipLeaveText}>Leave: {item.leaveCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // -------------------------------------------------------------
  // VIEW 2: Detail Screen for Selected Session (All Student Records)
  // -------------------------------------------------------------
  if (selectedSession) {
    return (
      <View style={styles.container}>
        {/* Detail Top Navigation Header */}
        <View style={styles.detailHeaderBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedSession(null);
              setDetailSearch('');
              setDetailFilter('ALL');
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.detailHeaderTitles}>
            <Text style={styles.detailHeaderTitle}>Attendance Session</Text>
            <Text style={styles.detailHeaderSubtitle}>
              {selectedSession.date} {selectedSession.time ? `• ${selectedSession.time}` : ''}
            </Text>
          </View>
        </View>

        {/* Session Quick KPI Card */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTopRow}>
            <View>
              <Text style={styles.kpiInstructorLabel}>Marked By</Text>
              <Text style={styles.kpiInstructorName}>{selectedSession.markedBy}</Text>
            </View>
            <View style={styles.kpiRateBox}>
              <Text style={styles.kpiRatePercent}>{selectedSession.attendanceRate}%</Text>
              <Text style={styles.kpiRateLabel}>Attendance</Text>
            </View>
          </View>

          <View style={styles.kpiCountsGrid}>
            <View style={[styles.kpiCountItem, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.kpiCountNumber, { color: '#065F46' }]}>
                {selectedSession.presentCount}
              </Text>
              <Text style={[styles.kpiCountLabel, { color: '#047857' }]}>Present</Text>
            </View>
            <View style={[styles.kpiCountItem, { backgroundColor: '#FEF2F2' }]}>
              <Text style={[styles.kpiCountNumber, { color: '#991B1B' }]}>
                {selectedSession.absentCount}
              </Text>
              <Text style={[styles.kpiCountLabel, { color: '#B91C1C' }]}>Absent</Text>
            </View>
            <View style={[styles.kpiCountItem, { backgroundColor: '#FFFBEB' }]}>
              <Text style={[styles.kpiCountNumber, { color: '#92400E' }]}>
                {selectedSession.lateCount}
              </Text>
              <Text style={[styles.kpiCountLabel, { color: '#B45309' }]}>Late</Text>
            </View>
            <View style={[styles.kpiCountItem, { backgroundColor: '#F1F5F9' }]}>
              <Text style={[styles.kpiCountNumber, { color: '#334155' }]}>
                {selectedSession.totalStudents}
              </Text>
              <Text style={[styles.kpiCountLabel, { color: '#64748B' }]}>Total</Text>
            </View>
          </View>
        </View>

        {/* Search Bar inside Detail View */}
        <View style={styles.searchContainer}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student name or ID..."
            placeholderTextColor={theme.colors.textMuted}
            value={detailSearch}
            onChangeText={setDetailSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, detailFilter === 'ALL' && styles.filterChipActive]}
              onPress={() => setDetailFilter('ALL')}
            >
              <Text style={[styles.filterChipText, detailFilter === 'ALL' && styles.filterChipTextActive]}>
                All ({selectedSession.totalStudents})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, detailFilter === 'Present' && styles.filterChipActive]}
              onPress={() => setDetailFilter('Present')}
            >
              <Text style={[styles.filterChipText, detailFilter === 'Present' && styles.filterChipTextActive]}>
                Present ({selectedSession.presentCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, detailFilter === 'Absent' && styles.filterChipActive]}
              onPress={() => setDetailFilter('Absent')}
            >
              <Text style={[styles.filterChipText, detailFilter === 'Absent' && styles.filterChipTextActive]}>
                Absent ({selectedSession.absentCount})
              </Text>
            </TouchableOpacity>
            {selectedSession.lateCount > 0 && (
              <TouchableOpacity
                style={[styles.filterChip, detailFilter === 'Late' && styles.filterChipActive]}
                onPress={() => setDetailFilter('Late')}
              >
                <Text style={[styles.filterChipText, detailFilter === 'Late' && styles.filterChipTextActive]}>
                  Late ({selectedSession.lateCount})
                </Text>
              </TouchableOpacity>
            )}
            {selectedSession.leaveCount > 0 && (
              <TouchableOpacity
                style={[styles.filterChip, detailFilter === 'Leave' && styles.filterChipActive]}
                onPress={() => setDetailFilter('Leave')}
              >
                <Text style={[styles.filterChipText, detailFilter === 'Leave' && styles.filterChipTextActive]}>
                  Leave ({selectedSession.leaveCount})
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Student Records FlatList */}
        <FlatList
          data={filteredDetailRecords}
          keyExtractor={item => item.attendance_id}
          contentContainerStyle={styles.detailListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>
                  {item.student_name ? item.student_name.charAt(0).toUpperCase() : 'S'}
                </Text>
              </View>

              <View style={styles.studentDetails}>
                <Text style={styles.studentCardName}>{item.student_name}</Text>
                <Text style={styles.studentCardId}>{item.student_id}</Text>
                {item.remarks ? (
                  <Text style={styles.studentRemarks} numberOfLines={2}>
                    Note: {item.remarks}
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.statusPill,
                  item.status === 'Present' && styles.statusPresent,
                  item.status === 'Absent' && styles.statusAbsent,
                  item.status === 'Late' && styles.statusLate,
                  item.status === 'Leave' && styles.statusLeave,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    item.status === 'Present' && { color: '#065F46' },
                    item.status === 'Absent' && { color: '#991B1B' },
                    item.status === 'Late' && { color: '#92400E' },
                    item.status === 'Leave' && { color: '#475569' },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptySearchContainer}>
              <Text style={styles.emptySearchTitle}>No students match this filter</Text>
              <Text style={styles.emptySearchSubtitle}>Try clearing search or filter.</Text>
            </View>
          }
        />
      </View>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: Main Sessions List (Grouped by Date & Time)
  // -------------------------------------------------------------
  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} title={t.attendance.historyTitle} />

      {/* Google Sheets Engine Header */}
      <View style={styles.sheetEngineBar}>
        <Cloud size={14} color="#047857" />
        <Text style={styles.sheetEngineText}>
          Google Sheets Database • {sessions.length} Sessions ({rawRecords.length} Logs)
        </Text>
      </View>

      {/* Search Bar for Sessions */}
      <View style={styles.searchContainer}>
        <Search size={16} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by date (YYYY-MM-DD) or instructor..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={item => item.sessionId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderSessionCard}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<ClipboardCheck size={32} color={theme.colors.primary} />}
              title={t.attendance.noSessions}
              subtitle="Mark attendance from the dashboard or attendance tab to record class sessions."
              actionLabel={t.dashboard.markAttendanceCta}
              onAction={() => navigation.navigate('TakeAttendance')}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sheetEngineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },

  // Session Card
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  sessionDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  dotSeparator: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginHorizontal: 2,
  },
  sessionTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ratePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  cardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sessionMetaInfo: {
    flex: 1,
  },
  studentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  studentCountText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  instructorText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  instructorBold: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  arrowIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  touchToViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  miniChipPresent: {
    backgroundColor: '#ECFDF5',
  },
  miniChipPresentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  miniChipAbsent: {
    backgroundColor: '#FEF2F2',
  },
  miniChipAbsentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  miniChipLate: {
    backgroundColor: '#FFFBEB',
  },
  miniChipLateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  miniChipLeave: {
    backgroundColor: '#F1F5F9',
  },
  miniChipLeaveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  // Detail Screen Styles
  detailHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 45,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderTitles: {
    flex: 1,
  },
  detailHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  detailHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    margin: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiInstructorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  kpiInstructorName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  kpiRateBox: {
    alignItems: 'flex-end',
  },
  kpiRatePercent: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065F46',
  },
  kpiRateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  kpiCountsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCountItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  kpiCountNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiCountLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  filterRow: {
    marginTop: 10,
    marginBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  detailListContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 40,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  studentAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  studentDetails: {
    flex: 1,
  },
  studentCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  studentCardId: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 1,
  },
  studentRemarks: {
    fontSize: 11,
    color: theme.colors.crimson,
    marginTop: 2,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  statusPresent: {
    backgroundColor: '#D1FAE5',
  },
  statusAbsent: {
    backgroundColor: '#FEE2E2',
  },
  statusLate: {
    backgroundColor: '#FEF3C7',
  },
  statusLeave: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptySearchSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
