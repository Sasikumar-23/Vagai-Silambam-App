import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { Award, Share2, Eye, Calendar, ShieldCheck, Plus, Check, Sparkles, X } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { BilingualInputField } from '../components/BilingualInputField';
import { CertificateRepository, CertificateWithDetails } from '../repositories/CertificateRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { EventRepository } from '../repositories/EventRepository';
import { Student, EventItem } from '../models/types';

export default function CertificatesScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [certificates, setCertificates] = useState<CertificateWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  // Issue Certificate Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleTa, setTitleTa] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Certificate Preview Modal
  const [previewCert, setPreviewCert] = useState<CertificateWithDetails | null>(null);

  useEffect(() => {
    if (isFocused) {
      loadCertificates();
      loadModalDependencies();
    }
  }, [isFocused]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const data = await CertificateRepository.getAllCertificates();
      setCertificates(data);
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

  const certificatePresets = [
    {
      label: 'Tournament Winner / சாம்பியன்',
      titleEn: 'State Level Silambam Championship - 1st Place',
      titleTa: 'மாநில அளவிலான சிலம்பப் போட்டி - முதலிடம்',
    },
    {
      label: 'Belt Grading / தகுதி நிலை',
      titleEn: 'Silambam Belt Grading & Rank Promotion',
      titleTa: 'சிலம்ப தகுதித் தேர்வு & நிலை உயர்வு சான்றிதழ்',
    },
    {
      label: 'Course Completion / பயிற்சி நிறைவு',
      titleEn: 'Traditional Silambam Martial Arts Course Completion',
      titleTa: 'பாரம்பரிய சிலம்பக் கலை பயிற்சி நிறைவு சான்றிதழ்',
    },
    {
      label: 'Participation / பங்கேற்பு',
      titleEn: 'Official Silambam Tournament Participation',
      titleTa: 'சிலம்பப் போட்டி பங்கேற்பு சான்றிதழ்',
    },
  ];

  const handleIssueCertificate = async () => {
    if (!selectedStudentId) {
      Alert.alert('Required', 'Please select a student.');
      return;
    }
    if (!titleEn.trim()) {
      Alert.alert('Required', 'Please enter a certificate title in English.');
      return;
    }

    setSaving(true);
    try {
      await CertificateRepository.issueCertificate(
        {
          student_id: selectedStudentId,
          event_id: selectedEventId || undefined,
          certificate_title_en: titleEn.trim(),
          certificate_title_ta: titleTa.trim() || titleEn.trim(),
          issue_date: issueDate,
          remarks: remarks.trim() || undefined,
        },
        currentUser?.id || 'admin'
      );

      Alert.alert('Success', 'Certificate issued successfully!');
      setModalVisible(false);
      setTitleEn('');
      setTitleTa('');
      setRemarks('');
      loadCertificates();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to issue certificate.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = (item: CertificateWithDetails) => {
    Alert.alert(
      'Share Certificate',
      `Certificate ${item.certificate_number} for ${item.student_name_en} is ready to export as PDF and share with parent/student.`
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.certificates.title} />

      <FlatList
        data={certificates}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.certCard}
            onPress={() => setPreviewCert(item)}
            activeOpacity={0.8}
          >
            <View style={styles.certHeader}>
              <View style={styles.codeBadge}>
                <ShieldCheck size={14} color={theme.colors.accent} />
                <Text style={styles.codeText}>{item.certificate_number}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setPreviewCert(item)}>
                  <Eye size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleShare(item)}>
                  <Share2 size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.titleEn}>{item.certificate_title_en}</Text>
            {item.certificate_title_ta && (
              <Text style={styles.titleTa}>{item.certificate_title_ta}</Text>
            )}

            <View style={styles.studentBlock}>
              <Text style={styles.studentLabel}>Awarded To / பெற்றவர்:</Text>
              <Text style={styles.studentName}>
                {language === 'ta' && item.student_name_ta ? item.student_name_ta : item.student_name_en} ({item.student_code})
              </Text>
            </View>

            <View style={styles.certFooter}>
              <View style={styles.dateRow}>
                <Calendar size={12} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>Issued: {item.issue_date}</Text>
              </View>
              {item.remarks && <Text style={styles.remarksText} numberOfLines={1}>{item.remarks}</Text>}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Award size={32} color={theme.colors.purple} />}
              title="No certificates issued"
              subtitle="Issue official certificates for rank grading, tournament honors, and course completions."
              actionLabel={currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR' ? t.certificates.issueCertificate : undefined}
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      {/* FAB to Issue Certificate */}
      {(currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ISSUE CERTIFICATE MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.certificates.issueCertificate}</Text>

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

              <Text style={styles.modalLabel}>Quick Templates / மாதிரித் தலைப்புகள்</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {certificatePresets.map((cp, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.presetChip}
                    onPress={() => {
                      setTitleEn(cp.titleEn);
                      setTitleTa(cp.titleTa);
                    }}
                  >
                    <Sparkles size={13} color={theme.colors.primary} />
                    <Text style={styles.presetChipText}>{cp.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Optional Event Selector */}
              {events.length > 0 && (
                <>
                  <Text style={styles.modalLabel}>Associated Event / Tournament (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.presetChip, !selectedEventId && styles.presetChipActive]}
                      onPress={() => setSelectedEventId('')}
                    >
                      <Text style={[styles.presetChipText, !selectedEventId && styles.presetChipTextActive]}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {events.map(ev => (
                      <TouchableOpacity
                        key={ev.id}
                        style={[styles.presetChip, selectedEventId === ev.id && styles.presetChipActive]}
                        onPress={() => {
                          setSelectedEventId(ev.id);
                          if (!titleEn) setTitleEn(`Certificate of Excellence - ${ev.name_en}`);
                          if (!titleTa) setTitleTa(`சிறப்புச் சான்றிதழ் - ${ev.name_ta || ev.name_en}`);
                        }}
                      >
                        <Text style={[styles.presetChipText, selectedEventId === ev.id && styles.presetChipTextActive]}>
                          {ev.name_en}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Bilingual Title */}
              <BilingualInputField
                labelEn="Certificate Title (English)"
                labelTa="சான்றிதழ் தலைப்பு (தமிழ்)"
                valueEn={titleEn}
                valueTa={titleTa}
                onChangeEn={setTitleEn}
                onChangeTa={setTitleTa}
                placeholderEn="e.g. State Level Silambam Championship Winner"
                placeholderTa="எ.கா. மாநில சிலம்ப சாம்பியன்ஷிப் முதலிட சான்றிதழ்"
                required
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Issue Date</Text>
                  <TextInput
                    mode="outlined"
                    value={issueDate}
                    onChangeText={setIssueDate}
                    placeholder="YYYY-MM-DD"
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Remarks / Signatory Note (Optional)</Text>
              <TextInput
                mode="outlined"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="e.g. Signed by Master Asan & Academy President"
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, saving && { opacity: 0.6 }]}
                  onPress={handleIssueCertificate}
                  disabled={saving}
                >
                  <Text style={styles.modalSubmitText}>
                    {saving ? 'Issuing...' : 'Issue Certificate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* VISUAL CERTIFICATE PREVIEW MODAL */}
      {previewCert && (
        <Modal visible={!!previewCert} animationType="fade" transparent>
          <View style={styles.previewOverlay}>
            <View style={styles.previewCard}>
              <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewCert(null)}>
                <X size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.certOrnament}>
                <Award size={36} color={theme.colors.gold} />
                <Text style={styles.certAcademyName}>VAGAI SILAMBAM ACADEMY</Text>
                <Text style={styles.certAcademyTamil}>வாகை சிலம்பம் கழகம்</Text>
                <Text style={styles.certHonorText}>CERTIFICATE OF ACHIEVEMENT</Text>

                <View style={styles.certDivider} />

                <Text style={styles.certToText}>This is proudly presented to</Text>
                <Text style={styles.certStudentName}>{previewCert.student_name_en}</Text>
                {previewCert.student_name_ta && (
                  <Text style={styles.certStudentTamil}>{previewCert.student_name_ta}</Text>
                )}
                <Text style={styles.certStudentId}>Roll ID: {previewCert.student_code}</Text>

                <Text style={styles.certForText}>in recognition of</Text>
                <Text style={styles.certMainTitle}>{previewCert.certificate_title_en}</Text>
                {previewCert.certificate_title_ta && (
                  <Text style={styles.certTitleTamil}>{previewCert.certificate_title_ta}</Text>
                )}

                <View style={styles.certSealRow}>
                  <View>
                    <Text style={styles.certMetaLabel}>Issued Date</Text>
                    <Text style={styles.certMetaValue}>{previewCert.issue_date}</Text>
                  </View>
                  <View style={styles.sealBadge}>
                    <ShieldCheck size={18} color="#B45309" />
                    <Text style={styles.sealText}>OFFICIAL SEAL</Text>
                  </View>
                  <View>
                    <Text style={styles.certMetaLabel}>Certificate No</Text>
                    <Text style={styles.certMetaValue}>{previewCert.certificate_number}</Text>
                  </View>
                </View>

                {previewCert.remarks && (
                  <Text style={styles.certRemarksNote}>"{previewCert.remarks}"</Text>
                )}
              </View>

              <TouchableOpacity style={styles.previewShareBtn} onPress={() => handleShare(previewCert)}>
                <Share2 size={16} color="#FFFFFF" />
                <Text style={styles.previewShareText}>Share / Export Certificate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 90,
  },
  certCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F9F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  titleEn: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  titleTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  studentBlock: {
    marginVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  studentLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2,
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceSubtle,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  remarksText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    maxWidth: '55%',
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
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  presetChipActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  presetChipTextActive: {
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
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 420,
    ...theme.shadows.lg,
  },
  closePreviewBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  certOrnament: {
    borderWidth: 3,
    borderColor: '#D97706',
    borderRadius: 12,
    padding: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
  },
  certAcademyName: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 6,
    letterSpacing: 1,
  },
  certAcademyTamil: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
  },
  certHonorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 4,
    letterSpacing: 1.5,
  },
  certDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    width: '80%',
    marginVertical: 10,
  },
  certToText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  certStudentName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  certStudentTamil: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
  },
  certStudentId: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  certForText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  certMainTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 2,
  },
  certTitleTamil: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    textAlign: 'center',
  },
  certSealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  certMetaLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  certMetaValue: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sealBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  sealText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#92400E',
    marginTop: 2,
  },
  certRemarksNote: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  previewShareBtn: {
    backgroundColor: theme.colors.primary,
    height: 46,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  previewShareText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

