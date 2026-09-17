import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, Alert, TouchableOpacity, Switch } from 'react-native';
import { Button, Text, Surface, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { storage, Student, AttendanceRecord } from '../utils/storage';
import { format } from 'date-fns';
import { Calendar, Download, ArrowLeft, UserCircle2, Send, Settings } from 'lucide-react-native';
import { exportAttendanceToCSV } from '../utils/export';
import { driveSync } from '../utils/driveSync';

export default function TakeAttendanceScreen({ navigation }: any) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const [allStudents, existingAttendance] = await Promise.all([
      storage.getStudents(),
      storage.getAttendanceByDate(dateKey)
    ]);
    
    setStudents(allStudents);
    setAttendance(existingAttendance || {});
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      await exportAttendanceToCSV(dateKey, students, attendance);
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export the attendance list.');
    } finally {
      setExporting(false);
    }
  };

  const handleSyncGoogleDrive = async () => {
    try {
      setExporting(true);
      const scriptUrl = await driveSync.getScriptUrl();
      if (!scriptUrl) {
        Alert.alert(
          'Sync Not Configured',
          'Please configure your Google Web App URL in settings first.',
          [
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
      
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const result = await driveSync.syncToGoogleDrive(dateKey, students, attendance, scriptUrl);
      
      if (result && result.success) {
        Alert.alert('Success', `Attendance for ${format(selectedDate, 'MMM dd, yyyy')} has been synced to Google Drive.`);
      } else {
        Alert.alert('Sync Failed', result.error || 'Check your internet connection or script deployment settings.');
      }
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Could not sync attendance data.');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    Alert.alert(
      'Export Attendance',
      'Choose how you want to save or share this report:',
      [
        {
          text: 'Share File (CSV)',
          onPress: handleExportCSV,
        },
        {
          text: 'Sync to Google Drive',
          onPress: handleSyncGoogleDrive,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const setStatus = (studentId: string, status: 'Present' | 'Absent') => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markedCount = Object.values(attendance).filter(s => s === 'Present' || s === 'Absent').length;
  const isAllMarked = students.length > 0 && markedCount === students.length && students.every(s => attendance[s.id] === 'Present');

  const toggleMarkAll = (val: boolean) => {
    if (val) {
      const newAttendance: AttendanceRecord = {};
      students.forEach(s => {
        newAttendance[s.id] = 'Present';
      });
      setAttendance(newAttendance);
    } else {
      setAttendance({});
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    await storage.saveAttendance(dateKey, attendance);
    setSaving(false);
    Alert.alert('Success', 'Attendance recorded successfully!');
    navigation.goBack();
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const renderStudentItem = ({ item }: { item: Student }) => {
    const currentStatus = attendance[item.id];
    return (
      <Surface style={styles.studentCard} elevation={1}>
        <View style={styles.studentHeader}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{item.name}</Text>
            <Text style={styles.studentId}>ID: #{item.id.slice(-5)}</Text>
          </View>
        </View>
        
        <View style={styles.statusButtonGroup}>
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              currentStatus === 'Present' && styles.presentButtonActive
            ]}
            onPress={() => setStatus(item.id, 'Present')}
          >
            <Text style={[
              styles.statusButtonText,
              currentStatus === 'Present' && styles.statusButtonTextActive
            ]}>Present</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              currentStatus === 'Absent' && styles.absentButtonActive
            ]}
            onPress={() => setStatus(item.id, 'Absent')}
          >
            <Text style={[
              styles.statusButtonText,
              currentStatus === 'Absent' && styles.statusButtonTextActive
            ]}>Absent</Text>
          </TouchableOpacity>
        </View>
      </Surface>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A3673" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#1A3673" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Take Attendance</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileButton}>
          <Settings color="#1A3673" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Surface style={styles.overviewCard} elevation={1}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewLabel}>SESSION OVERVIEW</Text>
            <View style={styles.overviewBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{students.length} Total</Text>
              </View>
              <View style={[styles.badge, styles.markedBadge]}>
                <Text style={[styles.badgeText, styles.markedBadgeText]}>{markedCount} Marked</Text>
              </View>
            </View>
          </View>
          <Text style={styles.overviewDate}>{format(selectedDate, 'EEEE, MMM dd, yyyy')}</Text>
        </Surface>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#1A3673" />
            ) : (
              <>
                <Download color="#1A3673" size={18} />
                <Text style={styles.exportButtonText}>Export List</Text>
              </>
            )}
          </TouchableOpacity>

          <Surface style={styles.toggleCard} elevation={1}>
            <Text style={styles.toggleLabel}>Mark All Present</Text>
            <Switch 
              value={isAllMarked} 
              onValueChange={toggleMarkAll}
              trackColor={{ false: '#D1D5DB', true: '#1A3673' }}
            />
          </Surface>
        </View>

        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          labelStyle={styles.submitButtonLabel}
          icon={() => <Send color="#fff" size={20} />}
        >
          SUBMIT ATTENDANCE
        </Button>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A3673',
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 0.5,
  },
  overviewBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#EBF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A3673',
  },
  markedBadge: {
    backgroundColor: '#82F3B2',
  },
  markedBadgeText: {
    color: '#00A86B',
  },
  overviewDate: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A3673',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF2FF',
    borderRadius: 12,
    height: 56,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C5D8F1',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3673',
  },
  toggleCard: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EBF2FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#C5D8F1',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3673',
  },
  listContent: {
    paddingBottom: 100,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  studentHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A3673',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBF2FF',
  },
  presentButtonActive: {
    backgroundColor: '#82F3B2',
  },
  absentButtonActive: {
    backgroundColor: '#FF4D4D',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3673',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  footer: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E9F0',
  },
  submitButton: {
    backgroundColor: '#1A3673',
    borderRadius: 12,
  },
  submitButtonContent: {
    height: 60,
    flexDirection: 'row-reverse',
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
