import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { ArrowLeft, Check, IndianRupee, Receipt, Share2, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { FeeRepository } from '../repositories/FeeRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { Fee, Student, Payment, PaymentMethod } from '../models/types';

export default function CollectPaymentScreen({ route, navigation }: any) {
  const { feeId } = route.params;
  const { t, language } = useI18n();
  const { currentUser } = useAuth();

  const [feeCalc, setFeeCalc] = useState<{
    fee: Fee;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
  } | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [txRef, setTxRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Receipt Modal State
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [createdPayment, setCreatedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    loadFee();
  }, [feeId]);

  const loadFee = async () => {
    try {
      const calc = await FeeRepository.getFeeCalculation(feeId);
      setFeeCalc(calc);
      setPaymentAmount(calc.remainingAmount.toString());

      const stu = await StudentRepository.getStudentById(calc.fee.student_id);
      setStudent(stu);
    } catch (e) {
      console.error('Failed to load fee calculation:', e);
    }
  };

  const handleProcessPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    if (feeCalc && amt > feeCalc.remainingAmount) {
      Alert.alert('Overpayment Error', t.fees.overpaymentError);
      return;
    }

    setSaving(true);
    try {
      const pay = await FeeRepository.recordPayment(
        feeId,
        amt,
        paymentMethod,
        currentUser?.full_name_en || 'Staff Accountant',
        txRef,
        remarks,
        currentUser?.id || 'staff'
      );

      setCreatedPayment(pay);
      setReceiptModalVisible(true);
    } catch (e: any) {
      Alert.alert('Payment Failed', e.message || 'Error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const methods: PaymentMethod[] = ['UPI', 'CASH', 'BANK_TRANSFER', 'ONLINE'];

  if (!feeCalc || !student) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t.fees.collectFee}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student & Fee Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.studentName}>
            {language === 'ta' && student.name_ta ? student.name_ta : student.name_en}
          </Text>
          <Text style={styles.studentId}>{student.student_id} • {student.training_level}</Text>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Total Fee</Text>
              <Text style={styles.balanceVal}>₹{feeCalc.totalAmount}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Already Paid</Text>
              <Text style={[styles.balanceVal, { color: theme.colors.accent }]}>₹{feeCalc.paidAmount}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Remaining</Text>
              <Text style={[styles.balanceVal, { color: theme.colors.crimson }]}>₹{feeCalc.remainingAmount}</Text>
            </View>
          </View>
        </View>

        {/* Payment Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Payment Details</Text>

          <Text style={styles.fieldLabel}>Payment Amount (₹) *</Text>
          <TextInput
            mode="outlined"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            style={styles.amountInput}
            outlineStyle={styles.outline}
          />

          <Text style={styles.fieldLabel}>{t.fees.paymentMethod} *</Text>
          <View style={styles.methodsRow}>
            {methods.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>
                  {m === 'UPI' ? 'UPI / GPay' : m === 'CASH' ? 'Cash' : m === 'BANK_TRANSFER' ? 'Bank' : 'Online'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>{t.fees.transactionRef}</Text>
          <TextInput
            mode="outlined"
            value={txRef}
            onChangeText={setTxRef}
            placeholder="e.g. UPI/4281940182 or Cash Receipt"
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <Text style={styles.fieldLabel}>{t.common.remarks}</Text>
          <TextInput
            mode="outlined"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional remarks"
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <TouchableOpacity
            style={[styles.paySubmitBtn, saving && { opacity: 0.6 }]}
            onPress={handleProcessPayment}
            disabled={saving}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.paySubmitText}>
              {saving ? 'Recording Payment...' : `Record Payment of ₹${paymentAmount}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* RECEIPT MODAL */}
      <Modal visible={receiptModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Receipt size={32} color={theme.colors.primary} />
              <Text style={styles.receiptOrg}>VAGAI SILAMBAM ACADEMY</Text>
              <Text style={styles.receiptOrgTa}>வாகை சிலம்பம் கழகம்</Text>
              <Text style={styles.receiptTag}>Official Fee Payment Receipt</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>Receipt Number:</Text>
              <Text style={styles.receiptValue}>{createdPayment?.payment_number}</Text>
            </View>
            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>Student:</Text>
              <Text style={styles.receiptValue}>{student.name_en} ({student.student_id})</Text>
            </View>
            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>Payment Date:</Text>
              <Text style={styles.receiptValue}>{createdPayment?.payment_date}</Text>
            </View>
            <View style={styles.receiptInfoRow}>
              <Text style={styles.receiptLabel}>Payment Method:</Text>
              <Text style={styles.receiptValue}>{createdPayment?.payment_method}</Text>
            </View>
            {createdPayment?.transaction_reference ? (
              <View style={styles.receiptInfoRow}>
                <Text style={styles.receiptLabel}>Txn Reference:</Text>
                <Text style={styles.receiptValue}>{createdPayment.transaction_reference}</Text>
              </View>
            ) : null}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Amount Received:</Text>
              <Text style={styles.receiptTotalVal}>₹{createdPayment?.amount}</Text>
            </View>

            <View style={styles.receiptFooterBadge}>
              <ShieldCheck size={16} color={theme.colors.accent} />
              <Text style={styles.receiptFooterText}>Digitally Verified & Recorded in SQLite</Text>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setReceiptModalVisible(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.doneBtnText}>Close & Return</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  studentId: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  balanceGrid: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  balanceVal: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 6,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: theme.spacing.lg,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  outline: {
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  methodBtnTextActive: {
    color: '#FFFFFF',
  },
  paySubmitBtn: {
    backgroundColor: theme.colors.accent,
    height: 52,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  paySubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xxl,
    ...theme.shadows.lg,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  receiptOrg: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 8,
  },
  receiptOrgTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  receiptTag: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  receiptInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  receiptValue: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  receiptTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  receiptTotalVal: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.accent,
  },
  receiptFooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    backgroundColor: '#E6F9F1',
    padding: 8,
    borderRadius: 8,
  },
  receiptFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  doneBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
