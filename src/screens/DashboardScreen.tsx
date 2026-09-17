import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Users, ClipboardCheck, Calendar, IndianRupee, Award, Shirt,
  TrendingUp, UserPlus, AlertCircle, ArrowRight, CheckCircle2
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { OfflineBanner } from '../components/OfflineBanner';
import { StatCard } from '../components/StatCard';
import { QuickActionCard } from '../components/QuickActionCard';
import { StatusBadge } from '../components/StatusBadge';
import { StudentRepository } from '../repositories/StudentRepository';
import { GoogleSheetsAttendanceService, AttendanceDashboardStats } from '../services/GoogleSheetsAttendanceService';
import { EventRepository } from '../repositories/EventRepository';
import { FeeRepository } from '../repositories/FeeRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { Student, EventItem, AuditLog } from '../models/types';
import { Cloud } from 'lucide-react-native';

export default function DashboardScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceDashboardStats>({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    leaveToday: 0,
    attendancePercentage: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [feeMetrics, setFeeMetrics] = useState({ totalCollection: 0, pendingTotal: 0, overdueTotal: 0 });
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
    }
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [students, events, fees, audits] = await Promise.all([
        StudentRepository.getAllStudents(undefined, 100),
        EventRepository.getAllEvents('OPEN'),
        FeeRepository.getSummaryMetrics(),
        AuditRepository.getRecentLogs(5),
      ]);

      // Calculate attendance dynamically from Google Sheets Attendance Engine
      const sheetAttStats = await GoogleSheetsAttendanceService.getDashboardAttendanceStats(
        todayStr,
        students.length
      );

      setTotalStudents(students.length);
      setRecentStudents(students.slice(0, 3));
      setTodayAttendance(sheetAttStats);
      setUpcomingEvents(events.slice(0, 2));
      setFeeMetrics(fees);
      setRecentAudits(audits);
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t.dashboard.greetingMorning;
    if (hours < 17) return t.dashboard.greetingAfternoon;
    return t.dashboard.greetingEvening;
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeTextGroup}>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.userNameText}>
              {language === 'ta' ? (currentUser?.full_name_ta || currentUser?.full_name_en) : (currentUser?.full_name_en || 'Silambam Master')}
            </Text>
            <Text style={styles.welcomeSubtext}>
              {language === 'ta' ? 'பாரம்பரிய சிலம்பப் பயிற்சி தளம்' : 'Tamil Nadu Silambam Training Platform'}
            </Text>
          </View>
        </View>

        {/* Quick Actions (Role-based) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.dashboard.quickActions}</Text>
          <View style={styles.quickGrid}>
            {(currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') && (
              <QuickActionCard
                title={t.quickActions.markAttendance}
                subtitle="Today's Session"
                icon={<ClipboardCheck size={22} color={theme.colors.accent} />}
                color={theme.colors.accent}
                bg={theme.colors.surface}
                onPress={() => navigation.navigate('TakeAttendance')}
              />
            )}

            {(currentRole === 'ADMIN' || currentRole === 'STAFF') && (
              <QuickActionCard
                title={t.quickActions.addStudent}
                subtitle="New Practitioner"
                icon={<UserPlus size={22} color={theme.colors.primary} />}
                color={theme.colors.primary}
                bg={theme.colors.surface}
                onPress={() => navigation.navigate('AddStudent')}
              />
            )}

            {(currentRole === 'ADMIN' || currentRole === 'STAFF') && (
              <QuickActionCard
                title={t.quickActions.collectFee}
                subtitle="UPI / Cash"
                icon={<Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.gold }}>₹</Text>}
                color={theme.colors.gold}
                bg={theme.colors.surface}
                onPress={() => navigation.navigate('Fees')}
              />
            )}

            <QuickActionCard
              title={t.nav.events}
              subtitle="Tournaments & Camps"
              icon={<Calendar size={22} color={theme.colors.purple} />}
              color={theme.colors.purple}
              bg={theme.colors.surface}
              onPress={() => navigation.navigate('Events')}
            />
          </View>
        </View>

        {/* Top Metric Cards */}
        <View style={styles.section}>
          <View style={styles.statsRow}>
            <StatCard
              label={t.dashboard.totalStudents}
              value={totalStudents}
              accentColor={theme.colors.primary}
              icon={<Users size={18} color={theme.colors.primary} />}
            />
            <StatCard
              label={t.dashboard.presentToday}
              value={todayAttendance.presentToday}
              accentColor={theme.colors.accent}
              trend={`${todayAttendance.attendancePercentage}% turn-out`}
              icon={<ClipboardCheck size={18} color={theme.colors.accent} />}
            />
          </View>

          <View style={[styles.statsRow, { marginTop: theme.spacing.md }]}>
            <StatCard
              label={t.dashboard.pendingFees}
              value={`₹${feeMetrics.pendingTotal.toLocaleString()}`}
              accentColor={theme.colors.gold}
              icon={<Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.gold }}>₹</Text>}
            />
            <StatCard
              label={t.dashboard.upcomingEvents}
              value={upcomingEvents.length}
              accentColor={theme.colors.purple}
              icon={<Calendar size={18} color={theme.colors.purple} />}
            />
          </View>
        </View>

        {/* Today's Attendance Box */}
        <View style={styles.attendanceActionBox}>
          <View style={styles.attHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.attBoxTitle}>{t.dashboard.todayAttendance}</Text>
              <Text style={styles.attBoxSubtitle} numberOfLines={1}>
                {new Date().toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })} • {todayAttendance.attendancePercentage}% Attendance
              </Text>
            </View>
            <TouchableOpacity
              style={styles.markAttendanceCtaBtn}
              onPress={() => navigation.navigate('TakeAttendance')}
              activeOpacity={0.8}
            >
              <Text style={styles.markAttendanceCtaText}>Mark Attendance</Text>
              <ArrowRight size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.attendanceStatsGrid}>
            <View style={[styles.attPill, { backgroundColor: '#E6F9F1' }]}>
              <Text style={[styles.attPillValue, { color: theme.colors.accent }]}>
                {todayAttendance.presentToday}
              </Text>
              <Text style={styles.attPillLabel}>{t.attendance.present}</Text>
            </View>
            <View style={[styles.attPill, { backgroundColor: '#FFE4E6' }]}>
              <Text style={[styles.attPillValue, { color: theme.colors.crimson }]}>
                {todayAttendance.absentToday}
              </Text>
              <Text style={styles.attPillLabel}>{t.attendance.absent}</Text>
            </View>
            <View style={[styles.attPill, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.attPillValue, { color: theme.colors.gold }]}>
                {todayAttendance.lateToday}
              </Text>
              <Text style={styles.attPillLabel}>{t.attendance.late}</Text>
            </View>
            <View style={[styles.attPill, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <Text style={[styles.attPillValue, { color: theme.colors.textMuted }]}>
                {todayAttendance.leaveToday}
              </Text>
              <Text style={styles.attPillLabel}>{t.attendance.leave}</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Events Carousel/Cards */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t.dashboard.upcomingEvents}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                <Text style={styles.viewAllLink}>{t.common.viewAll}</Text>
              </TouchableOpacity>
            </View>

            {upcomingEvents.map(ev => (
              <TouchableOpacity
                key={ev.id}
                style={styles.eventCard}
                onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}
                activeOpacity={0.7}
              >
                <View style={styles.eventDateBlock}>
                  <Text style={styles.eventMonth}>
                    {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={styles.eventDay}>
                    {new Date(ev.event_date).getDate()}
                  </Text>
                </View>

                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {language === 'ta' && ev.name_ta ? ev.name_ta : ev.name_en}
                  </Text>
                  <Text style={styles.eventLocation} numberOfLines={1}>
                    {language === 'ta' && ev.location_ta ? ev.location_ta : ev.location_en}
                  </Text>
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventFee}>
                      {ev.event_fee > 0 ? `₹${ev.event_fee}` : 'Free'}
                    </Text>
                    <StatusBadge status={ev.status} size="small" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Students */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t.students.title}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StudentsTab')}>
              <Text style={styles.viewAllLink}>{t.common.viewAll}</Text>
            </TouchableOpacity>
          </View>

          {recentStudents.map(student => (
            <TouchableOpacity
              key={student.id}
              style={styles.studentMiniCard}
              onPress={() => navigation.navigate('StudentDetail', { studentId: student.id })}
            >
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>
                  {student.name_en ? student.name_en.charAt(0).toUpperCase() : 'S'}
                </Text>
              </View>
              <View style={styles.miniInfo}>
                <Text style={styles.miniName}>{student.name_en}</Text>
                {student.name_ta && <Text style={styles.miniNameTa}>{student.name_ta}</Text>}
                <Text style={styles.miniCode}>{student.student_id} • {student.training_level}</Text>
              </View>
              <StatusBadge status={student.student_status} size="small" />
            </TouchableOpacity>
          ))}
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
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  welcomeBanner: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
  },
  welcomeTextGroup: {
    gap: 4,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.secondary,
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  welcomeSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  quickGrid: {
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  attendanceActionBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  attHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  attBoxTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  attBoxSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  markAttendanceCtaBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 6,
    minHeight: 40,
  },
  markAttendanceCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  attendanceStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  attPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  attPillValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  attPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  eventDateBlock: {
    backgroundColor: theme.colors.primaryMuted,
    width: 50,
    height: 54,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMonth: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  eventDay: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  eventLocation: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  eventFee: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  studentMiniCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  miniAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  miniInfo: {
    flex: 1,
  },
  miniName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  miniNameTa: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  miniCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sheetBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  sheetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
});
