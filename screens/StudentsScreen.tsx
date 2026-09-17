import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import { Text, Searchbar, useTheme, Surface, IconButton } from 'react-native-paper';
import { Users, UserCheck, Search, Edit2, UserPlus, ArrowLeft } from 'lucide-react-native';
import { storage, Student } from '../utils/storage';
import { useIsFocused } from '@react-navigation/native';

export default function StudentsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadStudents();
    }
  }, [isFocused]);

  const loadStudents = async () => {
    const data = await storage.getStudents();
    setStudents(data);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.includes(searchQuery)
  );

  const renderStudentItem = ({ item }: { item: Student }) => (
    <Surface style={styles.studentCard} elevation={1}>
      <TouchableOpacity 
        style={styles.studentInfo}
        onPress={() => navigation.navigate('EditStudent', { studentId: item.id })}
      >
        <View style={styles.avatarContainer}>
          <Users color="#666" size={24} />
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>ID: VS-2024-{item.id.slice(-3)}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => navigation.navigate('EditStudent', { studentId: item.id })}
      >
        <Edit2 color="#1A3673" size={20} />
      </TouchableOpacity>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft color="#1A3673" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Students</Text>
          <View style={styles.headerIcons}>
            <UserPlus color="#1A3673" size={24} style={{ marginRight: 16 }} />
            <Users color="#1A3673" size={24} />
          </View>
        </View>

        <Searchbar
          placeholder="Search by name or ID..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#999"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <Surface style={[styles.statCard, { backgroundColor: '#1A3673' }]} elevation={2}>
            <Text style={styles.statLabel}>TOTAL ENROLLED</Text>
            <Text style={styles.statValue}>{students.length}</Text>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: '#E6F4FE' }]} elevation={2}>
            <Text style={[styles.statLabel, { color: '#1A3673' }]}>ACTIVE THIS WEEK</Text>
            <Text style={[styles.statValue, { color: '#1A3673' }]}>{Math.floor(students.length * 0.8)}</Text>
          </Surface>
        </View>

        <FlatList
          data={filteredStudents}
          renderItem={renderStudentItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddStudent')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    backgroundColor: '#F5F7FB',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A3673',
    flex: 1,
    marginLeft: 20,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 50,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  searchInput: {
    fontSize: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
  },
  listContent: {
    paddingBottom: 100,
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
  editButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#1A3673',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
});
