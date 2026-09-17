import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Shirt, Plus, Check, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react-native';
import { TextInput } from 'react-native-paper';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { UniformRepository, UniformWithDetails } from '../repositories/UniformRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { Student, UniformType, UniformCondition, FeeStatus } from '../models/types';

export default function UniformsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole, currentUser } = useAuth();

  const [uniforms, setUniforms] = useState<UniformWithDetails[]>([]);
  const [uniformTypes, setUniformTypes] = useState<UniformType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'NEW' | 'GOOD' | 'RETURNED' | 'DAMAGED'>('ALL');

  // Issue modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('750');
  const [paymentStatus, setPaymentStatus] = useState<FeeStatus>('PAID');
  const [condition, setCondition] = useState<UniformCondition>('NEW');
  const [remarks, setRemarks] = useState('');
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadUniformData();
    }
  }, [isFocused]);

  const loadUniformData = async () => {
    try {
      const [list, types, stuList] = await Promise.all([
        UniformRepository.getAllUniforms(),
        UniformRepository.getUniformTypes(),
        StudentRepository.getAllStudents(undefined, 100),
      ]);
      setUniforms(list);
      setUniformTypes(types);
      setStudents(stuList);
      if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0].id);
      if (stuList.length > 0 && !selectedStudentId) setSelectedStudentId(stuList[0].id);
    } catch (e) {
      console.error('Failed to load uniforms:', e);
    }
  };

  const handleIssue = async () => {
    if (!selectedStudentId || !selectedTypeId) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be at least 1.');
      return;
    }

    setIssuing(true);
    try {
      await UniformRepository.issueUniform(
        selectedStudentId,
        selectedTypeId,
        size,
        qty,
        parseFloat(amount) || 0,
        paymentStatus,
        condition,
        remarks.trim() || undefined,
        currentUser?.id || 'staff'
      );

      Alert.alert('Issued', 'Uniform item issued successfully!');
      setModalVisible(false);
      setRemarks('');
      loadUniformData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to issue uniform.');
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = (item: UniformWithDetails) => {
    Alert.alert(
      'Return Item',
      `Mark ${item.item_name_en} as returned for ${item.student_name_en}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Returned',
          onPress: async () => {
            try {
              await UniformRepository.returnUniform(item.id, 'RETURNED', 'Returned in good condition', currentUser?.id);
              Alert.alert('Updated', 'Item marked as returned.');
              loadUniformData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update uniform.');
            }
          },
        },
      ]
    );
  };

  const sizePresets = ['4.0ft (Stick)', '5.0ft (Stick)', '5.5ft (Stick)', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const filteredList = uniforms.filter(u => {
    if (filter === 'ALL') return true;
    return u.condition === filter;
  });

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'ALL', label: 'All Items' },
    { key: 'NEW', label: 'Brand New' },
    { key: 'GOOD', label: 'In Use / Good' },
    { key: 'RETURNED', label: 'Returned' },
    { key: 'DAMAGED', label: 'Damaged' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.uniforms.title} />

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
          <View style={styles.uniformCard}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {language === 'ta' && item.item_name_ta ? item.item_name_ta : item.item_name_en}
                </Text>
                <Text style={styles.studentName}>
                  {language === 'ta' && item.student_name_ta ? item.student_name_ta : item.student_name_en} ({item.student_code})
                </Text>
              </View>
              <StatusBadge status={item.condition} size="small" />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Size: <Text style={styles.metaVal}>{item.size}</Text></Text>
              <Text style={styles.metaText}>Qty: <Text style={styles.metaVal}>{item.quantity}</Text></Text>
              <Text style={styles.metaText}>Cost: <Text style={styles.metaVal}>₹{item.amount}</Text></Text>
              <Text style={styles.metaText}>Payment: <Text style={[styles.metaVal, { color: item.payment_status === 'PAID' ? theme.colors.accent : theme.colors.crimson }]}>{item.payment_status}</Text></Text>
            </View>

            <View style={styles.cardBottomRow}>
              <Text style={styles.issueDate}>Issued on: {item.issue_date}</Text>
              {item.condition !== 'RETURNED' && (currentRole === 'ADMIN' || currentRole === 'STAFF') && (
                <TouchableOpacity style={styles.returnBtn} onPress={() => handleReturn(item)}>
                  <RotateCcw size={13} color={theme.colors.primary} />
                  <Text style={styles.returnBtnText}>Return</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Shirt size={32} color={theme.colors.primary} />}
            title="No uniforms issued yet"
            subtitle="Record traditional kurta, dhoti, sticks and sashes issued to practitioners."
            actionLabel={currentRole === 'ADMIN' || currentRole === 'STAFF' ? t.uniforms.issueUniform : undefined}
            onAction={() => setModalVisible(true)}
          />
        }
      />

      {/* FAB to Issue Uniform */}
      {(currentRole === 'ADMIN' || currentRole === 'STAFF') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ISSUE UNIFORM MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.uniforms.issueUniform}</Text>

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
                      {s.name_en} ({s.student_id})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Select Uniform / Weapon Item</Text>
              <View style={styles.typesRow}>
                {uniformTypes.map(ut => (
                  <TouchableOpacity
                    key={ut.id}
                    style={[styles.typeBtn, selectedTypeId === ut.id && styles.typeBtnActive]}
                    onPress={() => {
                      setSelectedTypeId(ut.id);
                      setAmount(ut.default_price.toString());
                    }}
                  >
                    <Text style={[styles.typeBtnText, selectedTypeId === ut.id && styles.typeBtnTextActive]}>
                      {language === 'ta' && ut.name_ta ? ut.name_ta : ut.name_en} (₹{ut.default_price})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Select Size or Stick Length</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {sizePresets.map(sz => (
                  <TouchableOpacity
                    key={sz}
                    style={[styles.sizeChip, size === sz && styles.sizeChipActive]}
                    onPress={() => setSize(sz)}
                  >
                    <Text style={[styles.sizeChipText, size === sz && styles.sizeChipTextActive]}>
                      {sz}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Quantity</Text>
                  <TextInput
                    mode="outlined"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </View>
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
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Payment Status</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.statusBtn, paymentStatus === 'PAID' && styles.statusBtnActive]}
                      onPress={() => setPaymentStatus('PAID')}
                    >
                      <Text style={[styles.statusBtnText, paymentStatus === 'PAID' && styles.statusBtnTextActive]}>
                        PAID
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusBtn, paymentStatus === 'PENDING' && styles.statusBtnActive]}
                      onPress={() => setPaymentStatus('PENDING')}
                    >
                      <Text style={[styles.statusBtnText, paymentStatus === 'PENDING' && styles.statusBtnTextActive]}>
                        PENDING
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Condition</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.statusBtn, condition === 'NEW' && styles.statusBtnActive]}
                      onPress={() => setCondition('NEW')}
                    >
                      <Text style={[styles.statusBtnText, condition === 'NEW' && styles.statusBtnTextActive]}>
                        NEW
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusBtn, condition === 'GOOD' && styles.statusBtnActive]}
                      onPress={() => setCondition('GOOD')}
                    >
                      <Text style={[styles.statusBtnText, condition === 'GOOD' && styles.statusBtnTextActive]}>
                        GOOD
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={[styles.modalLabel, { marginTop: 10 }]}>Remarks / Batch Notes (Optional)</Text>
              <TextInput
                mode="outlined"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="e.g. Issued with competition badge"
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, issuing && { opacity: 0.6 }]}
                  onPress={handleIssue}
                  disabled={issuing}
                >
                  <Text style={styles.modalSubmitText}>
                    {issuing ? 'Issuing...' : 'Confirm Issue'}
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
  uniformCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  studentName: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.sm,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaVal: {
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  issueDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  returnBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
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
  typesRow: {
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  typeBtn: {
    padding: 10,
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
  sizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  sizeChipActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  sizeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  sizeChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  statusBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 46,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
  },
  outline: {
    borderRadius: 8,
    borderColor: theme.colors.border,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.md,
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
