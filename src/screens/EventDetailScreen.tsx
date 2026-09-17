import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Modal, Alert
} from 'react-native';
import { TextInput } from 'react-native-paper';
import {
  Calendar, MapPin, Users, Award, Plus, ArrowLeft,
  CheckCircle2, IndianRupee, Trophy, UserPlus, Check
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { EventRepository } from '../repositories/EventRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { CertificateRepository } from '../repositories/CertificateRepository';
import { FeeRepository } from '../repositories/FeeRepository';
import { EventItem, Student, EventCustomField, EventResultType } from '../models/types';

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<EventCustomField[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);

  // Registration Modal State
  const [regModalVisible, setRegModalVisible] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Single Stick (ஒற்றைக்கம்பு)');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);

  // Result Modal State
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [resultStudentId, setResultStudentId] = useState('');
  const [resultType, setResultType] = useState<EventResultType>('Winner');
  const [resultPosition, setResultPosition] = useState('1st Place');
  const [resultMedal, setResultMedal] = useState('Gold Medal (தங்கப் பதக்கம்)');
  const [resultRemarks, setResultRemarks] = useState('');
  const [autoIssueCert, setAutoIssueCert] = useState(true);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    loadEventDetails();
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      const [ev, regs, cfs, stuList] = await Promise.all([
        EventRepository.getEventById(eventId),
        EventRepository.getEventRegistrations(eventId),
        EventRepository.getCustomFields(eventId),
        StudentRepository.getAllStudents(undefined, 100),
      ]);

      setEvent(ev);
      setRegistrations(regs);
      setCustomFields(cfs);
      setAvailableStudents(stuList);
      if (stuList.length > 0 && !selectedStudentId) setSelectedStudentId(stuList[0].id);
    } catch (e) {
      console.error('Error loading event detail:', e);
    }
  };

  const handleRegister = async () => {
    if (!selectedStudentId) {
      Alert.alert('Selection Required', 'Please choose a student to register.');
      return;
    }

    setRegistering(true);
    try {
      await EventRepository.registerStudentForEvent(
        eventId,
        selectedStudentId,
        {
          category: selectedCategory,
          customFieldValues: customValues,
        },
        currentUser?.id || 'instructor'
      );

      // If event has an entry fee, optionally create a fee record
      if (event && event.event_fee > 0) {
        try {
          const feeTypes = await FeeRepository.getFeeTypes();
          const eventFeeType = feeTypes.find(f => f.name_en.toLowerCase().includes('event') || f.name_en.toLowerCase().includes('competition')) || feeTypes[0];
          if (eventFeeType) {
            await FeeRepository.createFee(
              selectedStudentId,
              eventFeeType.id,
              event.event_fee,
              event.event_date,
              `Entry Fee: ${event.name_en}`,
              currentUser?.id || 'instructor'
            );
          }
        } catch (feeErr) {
          console.warn('Auto fee creation notice:', feeErr);
        }
      }

      Alert.alert('Registered', 'Student successfully registered for the event!');
      setRegModalVisible(false);
      loadEventDetails();
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Error registering student.');
    } finally {
      setRegistering(false);
    }
  };

  const handleSaveResult = async () => {
    if (!resultStudentId) return;
    setSavingResult(true);
    try {
      await EventRepository.recordEventResult(
        eventId,
        resultStudentId,
        {
          category: selectedCategory,
          result: resultType,
          position: resultPosition,
          medal: resultMedal,
          remarks: resultRemarks,
        },
        currentUser?.id || 'admin'
      );

      // Auto issue certificate if requested
      if (autoIssueCert) {
        try {
          const certTitleEn = `${resultPosition || resultType} - ${event?.name_en || 'Silambam Tournament'}`;
          const certTitleTa = `${resultType === 'Winner' ? 'முதலிடம்' : resultType === 'Runner-up' ? 'இரண்டாமிடம்' : 'சிறப்பு விருது'} - ${event?.name_ta || 'சிலம்பப் போட்டி'}`;
          await CertificateRepository.issueCertificate(
            {
              student_id: resultStudentId,
              event_id: eventId,
              certificate_title_en: certTitleEn,
              certificate_title_ta: certTitleTa,
              issue_date: event?.event_date || new Date().toISOString().split('T')[0],
              remarks: `${resultMedal || ''} • Position: ${resultPosition || ''}`.trim(),
            },
            currentUser?.id || 'admin'
          );
        } catch (certErr) {
          console.warn('Certificate auto-issue notice:', certErr);
        }
      }

      Alert.alert(
        'Result Saved',
        autoIssueCert
          ? 'Event result, student achievement, and official certificate created successfully!'
          : 'Event result and student achievement record created successfully!'
      );
      setResultModalVisible(false);
      loadEventDetails();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save result.');
    } finally {
      setSavingResult(false);
    }
  };

  const handleDirectCertificate = async (stuId: string, stuName: string) => {
    Alert.alert(
      'Issue Certificate',
      `Issue Participation/Honors Certificate for ${stuName} in ${event?.name_en}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Certificate',
          onPress: async () => {
            try {
              await CertificateRepository.issueCertificate(
                {
                  student_id: stuId,
                  event_id: eventId,
                  certificate_title_en: `Participation Certificate - ${event?.name_en}`,
                  certificate_title_ta: `பங்கேற்பு சான்றிதழ் - ${event?.name_ta || event?.name_en}`,
                  issue_date: event?.event_date || new Date().toISOString().split('T')[0],
                  remarks: `Participated in ${event?.name_en}`,
                },
                currentUser?.id || 'admin'
              );
              Alert.alert('Success', 'Certificate issued successfully!');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to issue certificate.');
            }
          },
        },
      ]
    );
  };

  if (!event) return null;

  const resultOptions: EventResultType[] = [
    'Winner', 'Runner-up', 'Third Place', 'Participation', 'Special Award'
  ];

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Event Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Event Card */}
        <View style={styles.bannerCard}>
          <View style={styles.statusRow}>
            <Text style={styles.codeText}>{event.event_code}</Text>
            <StatusBadge status={event.status} size="small" />
          </View>

          <Text style={styles.nameEn}>{event.name_en}</Text>
          {event.name_ta && <Text style={styles.nameTa}>{event.name_ta}</Text>}

          <View style={styles.infoLine}>
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={styles.infoText}>{event.event_date} ({event.start_time} - {event.end_time})</Text>
          </View>

          <View style={styles.infoLine}>
            <MapPin size={16} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              {language === 'ta' && event.location_ta ? event.location_ta : event.location_en}
            </Text>
          </View>

          <View style={styles.infoLine}>
            <IndianRupee size={16} color={theme.colors.accent} />
            <Text style={[styles.infoText, { fontWeight: '800', color: theme.colors.accent }]}>
              {event.event_fee > 0 ? `Entry Fee: ₹${event.event_fee}` : 'Free Entry'}
            </Text>
          </View>

          {event.description_en && (
            <Text style={styles.descText}>{event.description_en}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonRow}>
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => setRegModalVisible(true)}
            >
              <UserPlus size={16} color="#FFFFFF" />
              <Text style={styles.registerBtnText}>Register Practitioner</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Registered Participants */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Enrolled Participants ({registrations.length}
              {event.maximum_participants > 0 ? ` / ${event.maximum_participants}` : ''})
            </Text>
          </View>

          {registrations.map(reg => (
            <View key={reg.id} style={styles.regCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regName}>
                  {language === 'ta' && reg.name_ta ? reg.name_ta : reg.name_en}
                </Text>
                <Text style={styles.regCode}>{reg.student_code} • {reg.category || 'Standard Category'}</Text>
                <Text style={styles.regNum}>{reg.registration_code}</Text>
              </View>

              <View style={styles.regActions}>
                <StatusBadge status={reg.registration_status} size="small" />

                {reg.participation_status === 'PARTICIPATED' ? (
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={styles.medalPill}>
                      <Trophy size={12} color="#B45309" />
                      <Text style={styles.medalPillText}>Result Added</Text>
                    </View>
                    {(currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') && (
                      <TouchableOpacity
                        style={styles.certPillBtn}
                        onPress={() => handleDirectCertificate(reg.student_id, reg.name_en)}
                      >
                        <Award size={12} color={theme.colors.accent} />
                        <Text style={styles.certPillBtnText}>Certificate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  (currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') && (
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.addResultBtn}
                        onPress={() => {
                          setResultStudentId(reg.student_id);
                          setResultModalVisible(true);
                        }}
                      >
                        <Award size={12} color={theme.colors.primary} />
                        <Text style={styles.addResultText}>Enter Result</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.certPillBtn}
                        onPress={() => handleDirectCertificate(reg.student_id, reg.name_en)}
                      >
                        <Award size={12} color={theme.colors.accent} />
                        <Text style={styles.certPillBtnText}>Cert</Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            </View>
          ))}

          {registrations.length === 0 && (
            <Text style={styles.emptyText}>No students registered yet for this tournament.</Text>
          )}
        </View>
      </ScrollView>

      {/* REGISTRATION MODAL */}
      <Modal visible={regModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Student for Event</Text>

            <Text style={styles.modalLabel}>Select Student</Text>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {availableStudents.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.modalStuItem, selectedStudentId === s.id && styles.modalStuItemActive]}
                  onPress={() => setSelectedStudentId(s.id)}
                >
                  <Text style={[styles.modalStuName, selectedStudentId === s.id && styles.modalStuNameActive]}>
                    {s.name_en} ({s.student_id})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Competition Category</Text>
            <TextInput
              mode="outlined"
              value={selectedCategory}
              onChangeText={setSelectedCategory}
              placeholder="e.g. Single Stick, Double Stick, Weapons"
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />

            {/* Custom Fields Dynamic Inputs */}
            {customFields.map(cf => (
              <View key={cf.id} style={{ marginTop: 8 }}>
                <Text style={styles.modalLabel}>{cf.field_name_en} ({cf.field_name_ta})</Text>
                <TextInput
                  mode="outlined"
                  value={customValues[cf.id] || ''}
                  onChangeText={val => setCustomValues(prev => ({ ...prev, [cf.id]: val }))}
                  placeholder={`Enter ${cf.field_name_en}`}
                  style={styles.modalInput}
                  outlineStyle={styles.outline}
                />
              </View>
            ))}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRegModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, registering && { opacity: 0.6 }]}
                onPress={handleRegister}
                disabled={registering}
              >
                <Text style={styles.modalSubmitText}>
                  {registering ? 'Registering...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RECORD RESULT MODAL */}
      <Modal visible={resultModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Result & Award Medal</Text>

            <Text style={styles.modalLabel}>Result Standing</Text>
            <View style={styles.chipsRow}>
              {resultOptions.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.resultChip, resultType === r && styles.resultChipActive]}
                  onPress={() => setResultType(r)}
                >
                  <Text style={[styles.resultChipText, resultType === r && styles.resultChipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Position / Standing</Text>
            <TextInput
              mode="outlined"
              value={resultPosition}
              onChangeText={setResultPosition}
              placeholder="e.g. 1st Place / Gold Medal"
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />

            <Text style={styles.modalLabel}>Medal Awarded</Text>
            <TextInput
              mode="outlined"
              value={resultMedal}
              onChangeText={setResultMedal}
              placeholder="e.g. Gold Medal (தங்கப் பதக்கம்)"
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />

            {/* Auto-issue certificate toggle */}
            <TouchableOpacity
              style={styles.autoCertToggle}
              onPress={() => setAutoIssueCert(!autoIssueCert)}
            >
              <View style={[styles.checkbox, autoIssueCert && styles.checkboxActive]}>
                {autoIssueCert && <Check size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.autoCertText}>
                Automatically issue official certificate for this achievement
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Remarks & Master's Notes</Text>
            <TextInput
              mode="outlined"
              value={resultRemarks}
              onChangeText={setResultRemarks}
              placeholder="Optional notes"
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResultModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingResult && { opacity: 0.6 }]}
                onPress={handleSaveResult}
                disabled={savingResult}
              >
                <Text style={styles.modalSubmitText}>
                  {savingResult ? 'Saving...' : 'Save Result'}
                </Text>
              </TouchableOpacity>
            </View>
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
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  bannerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  nameEn: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  nameTa: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 12,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  descText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.lg,
  },
  registerBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  regCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  regName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  regCode: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  regNum: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  regActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  addResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.primaryMuted,
  },
  addResultText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  medalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  medalPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
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
    maxHeight: '85%',
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
    padding: 10,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceSubtle,
  },
  modalStuItemActive: {
    backgroundColor: theme.colors.primaryMuted,
  },
  modalStuName: {
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  modalStuNameActive: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    height: 44,
    fontSize: 13,
    marginBottom: 8,
  },
  outline: {
    borderRadius: 8,
    borderColor: theme.colors.border,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.lg,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  resultChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  resultChipActive: {
    backgroundColor: theme.colors.primary,
  },
  resultChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  resultChipTextActive: {
    color: '#FFFFFF',
  },
  certPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F9F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  certPillBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  autoCertToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 10,
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  autoCertText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
});
