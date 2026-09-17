import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { storage, Student, AttendanceRecord } from '../utils/storage';
import { format } from 'date-fns';
import { Calendar, UserCircle2, ClipboardCheck, Download, Settings } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { exportAttendanceToCSV } from '../utils/export';
import { driveSync } from '../utils/driveSync';

export default function AttendanceScreen({ navigation }: any) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [loading, setLoading] = useState(true);
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
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

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

  const markedCount = Object.keys(attendance).length;
  const presentCount = Object.values(attendance).filter(s => s === 'Present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'Absent').length;

  const renderStudentItem = ({ item }: { item: Student }) => {
    const status = attendance[item.id];
    return (
      <Surface style={styles.studentCard} elevation={1}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>ID: #{item.id.slice(-5)}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          status === 'Present' ? styles.presentBadge : status === 'Absent' ? styles.absentBadge : styles.pendingBadge
        ]}>
          <Text style={[
            styles.statusText,
            status === 'Present' ? styles.presentText : status === 'Absent' ? styles.absentText : styles.pendingText
          ]}>
            {status || 'Not Marked'}
          </Text>
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
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileButton}>
          <Settings color="#1A3673" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance History</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#1A3673" />
          ) : (
            <Download color="#1A3673" size={24} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Surface style={styles.dateCard} elevation={1}>
          <View style={styles.dateInfo}>
            <Text style={styles.dateLabel}>{format(selectedDate, 'EEEE, MMM dd, yyyy')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.calendarButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar color="#1A3673" size={24} />
          </TouchableOpacity>
        </Surface>

        <View style={styles.summaryRow}>
          <Surface style={[styles.summaryCard, { borderLeftColor: '#82F3B2' }]} elevation={1}>
            <Text style={styles.summaryValue}>{presentCount}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </Surface>
          <Surface style={[styles.summaryCard, { borderLeftColor: '#FF4D4D' }]} elevation={1}>
            <Text style={styles.summaryValue}>{absentCount}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </Surface>
          <Surface style={[styles.summaryCard, { borderLeftColor: '#1A3673' }]} elevation={1}>
            <Text style={styles.summaryValue}>{students.length - markedCount}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </Surface>
        </View>

        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ClipboardCheck color="#E5E9F0" size={80} />
              <Text style={styles.emptyText}>No students registered yet.</Text>
            </View>
          }
        />
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
    backgroundColor: '#F5F7FB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A3673',
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A3673',
  },
  calendarButton: {
    padding: 8,
    backgroundColor: '#EBF2FF',
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A3673',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  listContent: {
    paddingBottom: 40,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A3673',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  presentBadge: {
    backgroundColor: '#82F3B220',
  },
  absentBadge: {
    backgroundColor: '#FF4D4D20',
  },
  pendingBadge: {
    backgroundColor: '#F5F7FB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  presentText: {
    color: '#00A86B',
  },
  absentText: {
    color: '#FF4D4D',
  },
  pendingText: {
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
});
