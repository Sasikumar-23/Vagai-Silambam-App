import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { Award, Trophy, Calendar, Plus, Medal, Star, Shield, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { BilingualInputField } from '../components/BilingualInputField';
import { AchievementRepository, AchievementWithDetails } from '../repositories/AchievementRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { EventRepository } from '../repositories/EventRepository';
import { Student, EventItem } from '../models/types';

export default function AchievementsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [achievements, setAchievements] = useState<AchievementWithDetails[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'Competition' | 'Belt Grading' | 'Honor'>('ALL');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [achievementType, setAchievementType] = useState('Competition');
  const [titleEn, setTitleEn] = useState('');
  const [titleTa, setTitleTa] = useState('');
  const [position, setPosition] = useState('Gold Medal / 1st Place');
  const [achDate, setAchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [descEn, setDescEn] = useState('');
  const [descTa, setDescTa] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadAchievements();
      loadModalDependencies();
    }
  }, [isFocused]);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const data = await AchievementRepository.getAllAchievements();
      setAchievements(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadModalDependencies = async () => {
    try {
      const [stuList, evList] = await Promise.all([
        StudentRepository.getAllStudents(undefined, 100),
        EventRepository.getAllEvents(),
      ]);
      setStudents(stuList);
      setEvents(evList);
      if (stuList.length > 0 && !selectedStudentId) setSelectedStudentId(stuList[0].id);
    } catch (e) {
      console.warn('Failed loading dependencies:', e);
    }
  };

  const handleSaveAchievement = async () => {
    if (!selectedStudentId) {
      Alert.alert('Required', 'Please select a student.');
      return;
    }
    if (!titleEn.trim()) {
      Alert.alert('Required', 'Please enter an achievement title in English.');
      return;
    }

    setSaving(true);
    try {
      await AchievementRepository.addAchievement(
        {
          student_id: selectedStudentId,
          event_id: selectedEventId || undefined,
          achievement_type: achievementType,
          title_en: titleEn.trim(),
          title_ta: titleTa.trim() || titleEn.trim(),
          position: position.trim() || undefined,
          achievement_date: achDate,
          description_en: descEn.trim() || undefined,
          description_ta: descTa.trim() || undefined,
        },
        currentUser?.id || 'admin'
      );

      Alert.alert('Success', 'Student achievement recorded successfully!');
      setModalVisible(false);
      setTitleEn('');
      setTitleTa('');
      setDescEn('');
      setDescTa('');
      loadAchievements();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save achievement.');
    } finally {
      setSaving(false);
    }
  };

  const filteredList = achievements.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'Competition') return item.achievement_type === 'Competition' || !item.achievement_type;
    return item.achievement_type === filter;
  });

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'ALL', label: 'All Awards' },
    { key: 'Competition', label: 'Tournaments & Medals' },
    { key: 'Belt Grading', label: 'Belt Gradings' },
    { key: 'Honor', label: 'Honors & State' },
  ];

  const achievementTypes = [
    { key: 'Competition', label: 'Tournament Medal (போட்டிப் பதக்கம்)' },
    { key: 'Belt Grading', label: 'Belt Grading (நிலைத் தேர்வு)' },
    { key: 'Honor', label: 'Special Honor / Award (சிறப்பு விருது)' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.achievements.title} />

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filterTabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, filter === tab.key && styles.tabBtnActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.tabBtnText, filter === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.achievementCard}>
            <View style={styles.trophyCircle}>
              {item.achievement_type === 'Belt Grading' ? (
                <Shield size={24} color={theme.colors.accent} />
              ) : item.achievement_type === 'Honor' ? (
                <Star size={24} color={theme.colors.gold} />
              ) : (
                <Trophy size={24} color="#B45309" />
              )}
            </View>

            <View style={styles.details}>
              <Text style={styles.titleEn}>{item.title_en}</Text>
              {item.title_ta && <Text style={styles.titleTa}>{item.title_ta}</Text>}
              <Text style={styles.studentName}>
                {language === 'ta' && item.student_name_ta ? item.student_name_ta : item.student_name_en} ({item.student_code})
              </Text>
              {item.event_name_en && (
                <Text style={styles.eventName}>{item.event_name_en}</Text>
              )}
              <View style={styles.metaRow}>
                <Calendar size={12} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>{item.achievement_date} • {item.position || 'Winner'}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Award size={32} color={theme.colors.gold} />}
              title="No achievements yet"
              subtitle="Record state tournament medals, weapon awards and belt promotions."
              actionLabel={currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR' ? t.achievements.addAchievement : undefined}
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      {/* FAB to Add Achievement */}
      {(currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* RECORD ACHIEVEMENT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.achievements.addAchievement}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '85%' }}>
              <Text style={styles.modalLabel}>Select Student</Text>
              <ScrollView style={{ maxHeight: 110, marginBottom: 10 }} nestedScrollEnabled>
                {students.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.modalStuItem, selectedStudentId === s.id && styles.modalStuItemActive]}
                    onPress={() => setSelectedStudentId(s.id)}
                  >
                    <Text style={[styles.modalStuText, selectedStudentId === s.id && styles.modalStuTextActive]}>
                      {s.name_en} ({s.student_id}) - {s.training_level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Achievement Type</Text>
              <View style={styles.typesGrid}>
                {achievementTypes.map(at => (
                  <TouchableOpacity
                    key={at.key}
                    style={[styles.typeChip, achievementType === at.key && styles.typeChipActive]}
                    onPress={() => setAchievementType(at.key)}
                  >
                    <Text style={[styles.typeChipText, achievementType === at.key && styles.typeChipTextActive]}>
                      {at.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Optional Tournament / Event Selector */}
              {events.length > 0 && (
                <>
                  <Text style={styles.modalLabel}>Associated Event / Tournament (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.typeChip, !selectedEventId && styles.typeChipActive]}
                      onPress={() => setSelectedEventId('')}
                    >
                      <Text style={[styles.typeChipText, !selectedEventId && styles.typeChipTextActive]}>
                        None / General
                      </Text>
                    </TouchableOpacity>
                    {events.map(ev => (
                      <TouchableOpacity
                        key={ev.id}
                        style={[styles.typeChip, selectedEventId === ev.id && styles.typeChipActive]}
                        onPress={() => {
                          setSelectedEventId(ev.id);
                          if (!titleEn) setTitleEn(`Award - ${ev.name_en}`);
                          if (!titleTa) setTitleTa(`விருது - ${ev.name_ta || ev.name_en}`);
                        }}
                      >
                        <Text style={[styles.typeChipText, selectedEventId === ev.id && styles.typeChipTextActive]}>
                          {ev.name_en}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Bilingual Title */}
              <BilingualInputField
                labelEn="Achievement Title (English)"
                labelTa="சாதனை தலைப்பு (தமிழ்)"
                valueEn={titleEn}
                valueTa={titleTa}
                onChangeEn={setTitleEn}
                onChangeTa={setTitleTa}
                placeholderEn="e.g. State Level Single Stick Champion"
                placeholderTa="எ.கா. மாநில அளவிலான ஒற்றைக்கம்பு சாம்பியன்"
                required
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Position / Standing</Text>
                  <TextInput
                    mode="outlined"
                    value={position}
                    onChangeText={setPosition}
                    placeholder="e.g. 1st Place / Gold Medal"
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Date</Text>
                  <TextInput
                    mode="outlined"
                    value={achDate}
                    onChangeText={setAchDate}
                    placeholder="YYYY-MM-DD"
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
              </View>

              {/* Bilingual Description */}
              <BilingualInputField
                labelEn="Description & Master's Citation (English)"
                labelTa="விளக்கம் மற்றும் ஆசான் பாராட்டு (தமிழ்)"
                valueEn={descEn}
                valueTa={descTa}
                onChangeEn={setDescEn}
                onChangeTa={setDescTa}
                placeholderEn="Recognized for exceptional speed, defense, and technique."
                placeholderTa="சிறந்த வேகம் மற்றும் தற்காப்பு திறனுக்காக வழங்கப்பட்டது."
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSaveAchievement}
                  disabled={saving}
                >
                  <Text style={styles.modalSubmitText}>
                    {saving ? 'Saving...' : 'Record Achievement'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabRow: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 90,
  },
  achievementCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
    ...theme.shadows.sm,
  },
  trophyCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
  },
  titleEn: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  titleTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 3,
  },
  eventName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  modalStuItem: {
    padding: 8,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceSubtle,
  },
  modalStuItemActive: {
    backgroundColor: theme.colors.primaryMuted,
  },
  modalStuText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  modalStuTextActive: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  typesGrid: {
    gap: 6,
    marginBottom: 10,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  typeChipActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 46,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  outline: {
    borderRadius: 8,
    borderColor: theme.colors.border,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.sm,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

