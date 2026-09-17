import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, FlatList } from 'react-native';
import { Text, Surface, useTheme, ProgressBar } from 'react-native-paper';
import { UserCircle2, ClipboardCheck, ArrowRight, Users, Clock, LogOut, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { storage, Student } from '../utils/storage';
import { formatDistanceToNow, startOfMonth, isAfter } from 'date-fns';

export default function HomeScreen({ navigation }: any) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const [stats, setStats] = useState({ 
    students: 0, 
    records: 0, 
    growth: 0, 
    lastUpdate: 'Never' 
  });
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const loadData = async () => {
    try {
      const students = await storage.getStudents();
      const attendanceData = await storage.getAllAttendance();
      const lastUpdateTs = await storage.getLastAttendanceUpdate();
      
      // Calculate total records across all dates
      let totalRecords = 0;
      Object.values(attendanceData).forEach(dayRecord => {
        totalRecords += Object.values(dayRecord).filter(status => status === 'Present' || status === 'Absent').length;
      });

      // Calculate growth (students added this month)
      const monthStart = startOfMonth(new Date());
      const growthCount = students.filter(s => {
        const createDate = new Date(parseInt(s.id));
        return isAfter(createDate, monthStart);
      }).length;

      // Format last update time
      const lastUpdateStr = lastUpdateTs 
        ? `Updated ${formatDistanceToNow(lastUpdateTs)} ago`
        : 'No records yet';
      
      setStats({ 
        students: students.length, 
        records: totalRecords,
        growth: growthCount,
        lastUpdate: lastUpdateStr
      });
      setRecentStudents(students.slice(-3).reverse());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const renderRecentStudent = ({ item }: { item: Student }) => (
    <Surface style={styles.recentStudentCard} elevation={1}>
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          <Users color="#666" size={24} />
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>ID: 2024-STU-{item.id.slice(-3)}</Text>
        </View>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>Active</Text>
      </View>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Settings')} 
          style={styles.profileButton}
        >
          <Settings color="#1A3673" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vagai Silambam</Text>
        <TouchableOpacity 
          onPress={async () => {
            await storage.logout();
            navigation.replace('Login');
          }} 
          style={styles.profileButton}
        >
          <LogOut color="#1A3673" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsSection}>
          <Surface style={styles.statCard} elevation={2}>
            <Text style={styles.statLabel}>TOTAL STUDENTS</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{stats.students.toLocaleString()}</Text>
              <Text style={styles.statTrend}>+{stats.growth} this month</Text>
            </View>
            <ProgressBar progress={Math.min(stats.growth / 20, 1)} color="#1A3673" style={styles.progressBar} />
          </Surface>

          <Surface style={styles.statCard} elevation={2}>
            <Text style={styles.statLabel}>RECENT RECORDS</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{stats.records.toLocaleString()}</Text>
              <Text style={[styles.statTrend, { color: '#00A86B' }]}>{stats.lastUpdate}</Text>
            </View>
            <ProgressBar progress={Math.min(stats.records / 100, 1)} color="#00A86B" style={styles.progressBar} />
          </Surface>
        </View>

        <Surface style={styles.actionCard} elevation={3}>
          <Text style={styles.actionTitle}>Ready for the next session?</Text>
          <Text style={styles.actionSubtitle}>Record student presence instantly using the digital registry.</Text>
          <TouchableOpacity 
            style={styles.attendanceButton}
            onPress={() => navigation.navigate('TakeAttendance')}
          >
            <ClipboardCheck color="#1A3673" size={24} />
            <Text style={styles.attendanceButtonText}>Take Attendance</Text>
          </TouchableOpacity>
        </Surface>

        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Students</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Students')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentStudents.map((item) => (
          <View key={item.id}>
            {renderRecentStudent({ item })}
          </View>
        ))}
      </ScrollView>
    </View>
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
    fontSize: 22,
    fontWeight: '900',
    color: '#1A3673',
  },
  profileButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  statsSection: {
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A3673',
    marginRight: 12,
  },
  statTrend: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00A86B',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EBF2FF',
  },
  actionCard: {
    backgroundColor: '#1A3673',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    marginBottom: 24,
  },
  attendanceButton: {
    backgroundColor: '#82F3B2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 12,
    gap: 12,
  },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3673',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A3673',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3673',
  },
  recentStudentCard: {
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F5F7FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  nameContainer: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A3673',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#82F3B2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00A86B',
  },
});








