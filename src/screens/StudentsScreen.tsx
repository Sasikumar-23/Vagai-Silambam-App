import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Search, Plus, Filter, Users } from 'lucide-react-native';
import { TextInput } from 'react-native-paper';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { AppHeader } from '../components/AppHeader';
import { StudentCard } from '../components/StudentCard';
import { EmptyState } from '../components/EmptyState';
import { StudentRepository } from '../repositories/StudentRepository';
import { Student, TrainingLevel, StudentStatus } from '../models/types';

export default function StudentsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t } = useI18n();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRates, setAttendanceRates] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<TrainingLevel | 'ALL'>('ALL');
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(false);

  // Debounce search query by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (isFocused) {
      loadStudents();
    }
  }, [isFocused, debouncedQuery, selectedLevel, onlyActive]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await StudentRepository.getAllStudents({
        query: debouncedQuery,
        level: selectedLevel === 'ALL' ? undefined : selectedLevel,
        status: onlyActive ? 'ACTIVE' : undefined,
      });
      setStudents(data);

      // Fast single batch query for all visible students
      const studentIds = data.slice(0, 50).map(s => s.id);
      const rates = await StudentRepository.getAttendanceRatesBatch(studentIds);
      setAttendanceRates(rates);
    } catch (e) {
      console.error('Failed to load students:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phoneNumber?: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber.replace(/[^0-9+]/g, '')}`);
    }
  };

  const levels: (TrainingLevel | 'ALL')[] = [
    'ALL',
    'BEGINNER',
    'BASIC',
    'INTERMEDIATE',
    'ADVANCED',
    'MASTER',
  ];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} title={t.students.title} />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TextInput
          mode="outlined"
          placeholder={t.students.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          left={<TextInput.Icon icon={() => <Search size={20} color={theme.colors.textMuted} />} />}
          style={styles.searchInput}
          outlineStyle={styles.searchOutline}
          clearButtonMode="while-editing"
        />

        {/* Filter Chips Horizontal Scroll */}
        <FlatList
          horizontal
          data={levels}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }) => {
            const isSelected = selectedLevel === item;
            return (
              <TouchableOpacity
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedLevel(item)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {item === 'ALL' ? t.students.filterAll : item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Student List */}
      <FlatList
        data={students}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            attendancePercentage={attendanceRates[item.id]}
            onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
            onCall={() => handleCall(item.contact_number)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Users size={32} color={theme.colors.primary} />}
              title={t.students.emptyList}
              subtitle="Try adjusting your search query or level filters"
              actionLabel={t.students.emptyCta}
              onAction={() => navigation.navigate('AddStudent')}
            />
          ) : null
        }
      />

      {/* FAB to Add Student */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddStudent')}
        activeOpacity={0.8}
        accessibilityLabel="Enroll New Student"
      >
        <Plus size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchSection: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    height: 48,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: theme.spacing.md,
  },
  chip: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 90,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
});
