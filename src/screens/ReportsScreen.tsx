import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Download, FileText, CheckCircle2, IndianRupee, Users, Award } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { AppHeader } from '../components/AppHeader';
import { ReportService } from '../services/ReportService';
import { StudentRepository } from '../repositories/StudentRepository';

export default function ReportsScreen({ navigation }: any) {
  const { t, language } = useI18n();

  const [exporting, setExporting] = useState(false);

  const handleExportAttendance = async () => {
    setExporting(true);
    try {
      const data = await ReportService.getAttendanceReportData();
      const headers = ['Student ID', 'Name (EN)', 'Name (TA)', 'Level', 'Center', 'Total Sessions', 'Present', 'Absent', 'Late', 'Leave'];
      const rows = data.map(d => [
        d.student_code,
        d.name_en,
        d.name_ta || '',
        d.training_level,
        d.center_name,
        d.total_sessions,
        d.present_count,
        d.absent_count,
        d.late_count,
        d.leave_count,
      ]);

      await ReportService.exportReportToCSV('Vagai_Attendance_Report.csv', headers, rows);
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export attendance.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFees = async () => {
    setExporting(true);
    try {
      const data = await ReportService.getFeeReportData();
      const headers = ['Student ID', 'Name (EN)', 'Fee Number', 'Fee Type', 'Total Fee', 'Paid Amount', 'Remaining', 'Due Date', 'Status'];
      const rows = data.map(d => [
        d.student_code,
        d.name_en,
        d.fee_number,
        d.fee_type,
        d.total_amount,
        d.paid_amount,
        d.remaining_amount,
        d.due_date,
        d.status,
      ]);

      await ReportService.exportReportToCSV('Vagai_Fee_Report.csv', headers, rows);
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export fees.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportRoster = async () => {
    setExporting(true);
    try {
      const students = await StudentRepository.getAllStudents();
      const headers = ['Student ID', 'Roll No', 'Name (EN)', 'Name (TA)', 'DOB', 'Gender', 'Phone', 'Level', 'Status', 'Joining Date'];
      const rows = students.map(s => [
        s.student_id,
        s.roll_number || '',
        s.name_en,
        s.name_ta || '',
        s.date_of_birth,
        s.gender,
        s.contact_number,
        s.training_level,
        s.student_status,
        s.joining_date,
      ]);

      await ReportService.exportReportToCSV('Vagai_Student_Roster.csv', headers, rows);
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export roster.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.reports.title} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.introText}>
          Generate and share verified mobile CSV spreadsheets and summaries for Vagai Silambam Academy.
        </Text>

        {/* Report 1: Attendance */}
        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#E6F9F1' }]}>
              <CheckCircle2 size={24} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>{t.reports.attendanceReport}</Text>
              <Text style={styles.reportDesc}>
                Detailed presence, absence, late attendance and rate percentages per student.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportAttendance}
            disabled={exporting}
          >
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Attendance CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Report 2: Fee Collections */}
        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: theme.colors.gold }}>₹</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>{t.reports.feeCollectionReport}</Text>
              <Text style={styles.reportDesc}>
                Complete fee registers, collected tuition, pending balances, and overdue accounts.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportFees}
            disabled={exporting}
          >
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Fee Collections CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Report 3: Student Roster */}
        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.primaryMuted }]}>
              <Users size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>{t.reports.studentRoster}</Text>
              <Text style={styles.reportDesc}>
                Master practitioner directory including contact information and Silambam rank levels.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportRoster}
            disabled={exporting}
          >
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Student Roster CSV</Text>
          </TouchableOpacity>
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
  introText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  reportCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: theme.spacing.lg,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  reportDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  exportBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
