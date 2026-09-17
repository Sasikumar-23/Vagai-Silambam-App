import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { IndianRupee, Plus, ArrowRight, AlertCircle, CheckCircle2, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { FeeRepository, FeeWithDetails } from '../repositories/FeeRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { FeeStatus, FeeType, Student } from '../models/types';

export default function FeesScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [fees, setFees] = useState<FeeWithDetails[]>([]);
  const [metrics, setMetrics] = useState({ totalCollection: 0, pendingTotal: 0, overdueTotal: 0 });
  const [statusFilter, setStatusFilter] = useState<FeeStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);

  // Create Fee Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [assignMode, setAssignMode] = useState<'SINGLE' | 'ALL'>('SINGLE');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadFees();
      loadModalData();
    }
  }, [isFocused, statusFilter]);

  const loadFees = async () => {
    setLoading(true);
    try {
      const [feeList, sumMetrics] = await Promise.all([
        FeeRepository.getAllFeesWithDetails(
          statusFilter === 'ALL' ? undefined : { status: statusFilter }
        ),
        FeeRepository.getSummaryMetrics(),
      ]);
      setFees(feeList);
      setMetrics(sumMetrics);
    } catch (e) {
      console.error('Failed loading fees:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    try {
      const [stuList, types] = await Promise.all([
        StudentRepository.getAllStudents(undefined, 100),
        FeeRepository.getFeeTypes(),
      ]);
      setStudents(stuList);
      setFeeTypes(types);
      if (stuList.length > 0 && !selectedStudentId) setSelectedStudentId(stuList[0].id);
      if (types.length > 0 && !selectedFeeTypeId) {
        setSelectedFeeTypeId(types[0].id);
        setAmount(types[0].default_amount.toString());
      }
    } catch (e) {
      console.error('Failed loading modal data:', e);
    }
  };

  const handleCreateFee = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid fee amount.');
      return;
    }
    if (!selectedFeeTypeId) {
      Alert.alert('Required', 'Please select a fee type.');
      return;
    }

    setSaving(true);
    try {
      if (assignMode === 'SINGLE') {
        if (!selectedStudentId) {
          Alert.alert('Required', 'Please select a student.');
          setSaving(false);
          return;
        }
        await FeeRepository.createFee(
          selectedStudentId,
          selectedFeeTypeId,
          parsedAmount,
          dueDate,
          description.trim() || undefined,
          currentUser?.id || 'admin'
        );
        Alert.alert('Success', 'Fee assigned successfully!');
      } else {
        const studentIds = students.filter(s => s.student_status === 'ACTIVE').map(s => s.id);
        const res = await FeeRepository.createBulkFee(
          studentIds,
          selectedFeeTypeId,
          parsedAmount,
          dueDate,
          description.trim() || undefined,
          currentUser?.id || 'admin'
        );
        Alert.alert('Success', `Fee assigned to ${res.created} active students!`);
      }

      setModalVisible(false);
      loadFees();
    } catch (e: any) {
      Alert.alert('Creation Failed', e.message || 'Error creating fee.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: FeeStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'All Fees' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'PAID', label: 'Paid' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.fees.title} />

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <StatCard
          label={t.dashboard.monthlyCollection}
          value={`₹${metrics.totalCollection.toLocaleString()}`}
          accentColor={theme.colors.accent}
          icon={<Text style={{ fontSize: 16, fontWeight: '900', color: theme.colors.accent }}>₹</Text>}
        />
        <StatCard
          label={t.dashboard.pendingFees}
          value={`₹${metrics.pendingTotal.toLocaleString()}`}
          accentColor={theme.colors.gold}
          icon={<Text style={{ fontSize: 16, fontWeight: '900', color: theme.colors.gold }}>₹</Text>}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, statusFilter === tab.key && styles.tabBtnActive]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[styles.tabBtnText, statusFilter === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={fees}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.feeCard}>
            <View style={styles.feeTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>
                  {language === 'ta' && item.student_name_ta ? item.student_name_ta : item.student_name_en}
                </Text>
                <Text style={styles.feeType}>
                  {language === 'ta' && item.fee_type_name_ta ? item.fee_type_name_ta : item.fee_type_name_en}
                </Text>
              </View>
              <StatusBadge status={item.status} size="small" />
            </View>

            <View style={styles.amountsRow}>
              <View>
                <Text style={styles.amountLabel}>Total Fee</Text>
                <Text style={styles.totalAmount}>₹{item.amount}</Text>
              </View>
              <View>
                <Text style={styles.amountLabel}>Paid</Text>
                <Text style={styles.paidAmount}>₹{item.paid_amount}</Text>
              </View>
              <View>
                <Text style={styles.amountLabel}>Pending</Text>
                <Text style={styles.remainingAmount}>₹{item.remaining_amount}</Text>
              </View>
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.dueDate}>Due Date: {item.due_date}</Text>

              {item.status !== 'PAID' && item.status !== 'WAIVED' && (
                <TouchableOpacity
                  style={styles.collectBtn}
                  onPress={() => navigation.navigate('CollectPayment', { feeId: item.id })}
                >
                  <Text style={styles.collectBtnText}>{t.fees.collectFee}</Text>
                  <ArrowRight size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.primary }}>₹</Text>}
              title="No fee records found"
              subtitle="Assign monthly training fees, tournament fees or belt exam fees."
              actionLabel={currentRole === 'ADMIN' || currentRole === 'STAFF' ? 'Assign New Fee' : undefined}
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      {/* FAB to Assign / Create Fee */}
      {(currentRole === 'ADMIN' || currentRole === 'STAFF') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* CREATE / ASSIGN FEE MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Fee / கட்டணம் ஒதுக்கு</Text>

            {/* Mode Switcher: Single Student vs All Active Students */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, assignMode === 'SINGLE' && styles.modeBtnActive]}
                onPress={() => setAssignMode('SINGLE')}
              >
                <Text style={[styles.modeBtnText, assignMode === 'SINGLE' && styles.modeBtnTextActive]}>
                  Single Student
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, assignMode === 'ALL' && styles.modeBtnActive]}
                onPress={() => setAssignMode('ALL')}
              >
                <Text style={[styles.modeBtnText, assignMode === 'ALL' && styles.modeBtnTextActive]}>
                  All Active Students ({students.filter(s => s.student_status === 'ACTIVE').length})
                </Text>
              </TouchableOpacity>
            </View>

            {assignMode === 'SINGLE' && (
              <>
                <Text style={styles.modalLabel}>Select Student</Text>
                <ScrollView style={{ maxHeight: 110, marginBottom: 10 }} nestedScrollEnabled>
                  {students.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.modalStuItem, selectedStudentId === s.id && styles.modalStuItemActive]}
                      onPress={() => setSelectedStudentId(s.id)}
                    >
                      <Text style={[styles.modalStuText, selectedStudentId === s.id && styles.modalStuTextActive]}>
                        {s.name_en} ({s.student_id})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.modalLabel}>Fee Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.typesRow}>
                {feeTypes.map(ft => (
                  <TouchableOpacity
                    key={ft.id}
                    style={[styles.typeBtn, selectedFeeTypeId === ft.id && styles.typeBtnActive]}
                    onPress={() => {
                      setSelectedFeeTypeId(ft.id);
                      setAmount(ft.default_amount.toString());
                    }}
                  >
                    <Text style={[styles.typeBtnText, selectedFeeTypeId === ft.id && styles.typeBtnTextActive]}>
                      {language === 'ta' && ft.name_ta ? ft.name_ta : ft.name_en} (₹{ft.default_amount})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Amount (₹)</Text>
                <TextInput
                  mode="outlined"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Due Date</Text>
                <TextInput
                  mode="outlined"
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Description / Notes (Optional)</Text>
            <TextInput
              mode="outlined"
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Monthly Silambam Class Fee"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreateFee}
                disabled={saving}
              >
                <Text style={styles.modalSubmitText}>
                  {saving ? 'Assigning...' : 'Assign Fee'}
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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
    marginTop: theme.spacing.md,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  feeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  feeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  feeType: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  amountLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  paidAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.accent,
    marginTop: 2,
  },
  remainingAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.crimson,
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  collectBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  collectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modeBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
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
  typesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeBtnTextActive: {
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

