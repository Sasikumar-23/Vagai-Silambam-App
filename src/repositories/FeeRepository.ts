import { getDatabase } from '../database/connection';
import { Fee, Payment, FeeType, FeeStatus, PaymentMethod } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface FeeWithDetails extends Fee {
  student_name_en: string;
  student_name_ta: string;
  student_code: string;
  fee_type_name_en: string;
  fee_type_name_ta: string;
  paid_amount: number;
  remaining_amount: number;
}

export const FeeRepository = {
  async generatePaymentNumber(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `VSP-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_code: string | null }>(
      'SELECT MAX(payment_number) as max_code FROM payments WHERE payment_number LIKE ?',
      `${prefix}%`
    );

    let nextNum = 1;
    if (row && row.max_code) {
      const parts = row.max_code.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    return `${prefix}${nextNum.toString().padStart(5, '0')}`;
  },

  async generateFeeNumber(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `FEE-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_code: string | null }>(
      'SELECT MAX(fee_number) as max_code FROM fees WHERE fee_number LIKE ?',
      `${prefix}%`
    );

    let nextNum = 1;
    if (row && row.max_code) {
      const parts = row.max_code.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  },

  async getFeeTypes(): Promise<FeeType[]> {
    const db = await getDatabase();
    return db.getAllAsync<FeeType>('SELECT * FROM fee_types WHERE is_active = 1 ORDER BY name_en ASC');
  },

  async createFee(
    studentId: string,
    feeTypeId: string,
    amount: number,
    dueDate: string,
    description?: string,
    userId: string = 'system'
  ): Promise<Fee> {
    if (amount <= 0) throw new Error('Fee amount must be greater than zero.');
    const db = await getDatabase();
    const feeId = 'fee_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const feeNumber = await this.generateFeeNumber();

    await db.runAsync(
      `INSERT INTO fees (
        id, fee_number, student_id, fee_type_id, description, amount, due_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      feeId,
      feeNumber,
      studentId,
      feeTypeId,
      description || null,
      amount,
      dueDate,
      userId
    );

    await AuditRepository.log('CREATE_FEE', 'fees', feeId, userId, null, {
      fee_number: feeNumber,
      student_id: studentId,
      amount
    });

    const fee = await db.getFirstAsync<Fee>('SELECT * FROM fees WHERE id = ?', feeId);
    if (!fee) throw new Error('Failed to create fee record.');
    return fee;
  },

  async createBulkFee(
    studentIds: string[],
    feeTypeId: string,
    amount: number,
    dueDate: string,
    description?: string,
    userId: string = 'system'
  ): Promise<{ created: number; failed: number }> {
    let created = 0;
    let failed = 0;
    for (const stuId of studentIds) {
      try {
        await this.createFee(stuId, feeTypeId, amount, dueDate, description, userId);
        created++;
      } catch (e) {
        failed++;
      }
    }
    return { created, failed };
  },

  async getAllFeesWithDetails(filters?: {
    studentId?: string;
    status?: FeeStatus;
  }): Promise<FeeWithDetails[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.studentId) {
      conditions.push('f.student_id = ?');
      params.push(filters.studentId);
    }

    if (filters?.status) {
      conditions.push('f.status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT 
        f.*,
        s.name_en AS student_name_en,
        s.name_ta AS student_name_ta,
        s.student_id AS student_code,
        ft.name_en AS fee_type_name_en,
        ft.name_ta AS fee_type_name_ta,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.fee_id = f.id), 0.0) AS paid_amount,
        ROUND(f.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.fee_id = f.id), 0.0), 2) AS remaining_amount
      FROM fees f
      JOIN students s ON f.student_id = s.id
      JOIN fee_types ft ON f.fee_type_id = ft.id
      ${whereClause}
      ORDER BY f.due_date ASC
    `;

    return db.getAllAsync<FeeWithDetails>(sql, ...params);
  },

  async getFeeCalculation(feeId: string): Promise<{
    fee: Fee;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
  }> {
    const db = await getDatabase();
    const fee = await db.getFirstAsync<Fee>('SELECT * FROM fees WHERE id = ?', feeId);
    if (!fee) throw new Error('Fee record not found.');

    const paidRow = await db.getFirstAsync<{ total_paid: number | null }>(
      'SELECT SUM(amount) AS total_paid FROM payments WHERE fee_id = ?',
      feeId
    );
    const paidAmount = paidRow?.total_paid || 0.0;
    const remainingAmount = Math.max(0, fee.amount - paidAmount);

    return {
      fee,
      totalAmount: fee.amount,
      paidAmount,
      remainingAmount
    };
  },

  async recordPayment(
    feeId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    receivedBy: string,
    transactionReference?: string,
    remarks?: string,
    userId: string = 'system'
  ): Promise<Payment> {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const db = await getDatabase();
    const paymentUuid = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const paymentNumber = await this.generatePaymentNumber();

    await db.withTransactionAsync(async () => {
      // 1. Calculate balance
      const calc = await this.getFeeCalculation(feeId);
      if (amount > calc.remainingAmount) {
        throw new Error(`Payment of ₹${amount} exceeds pending amount of ₹${calc.remainingAmount}.`);
      }

      // 2. Insert Payment
      await db.runAsync(
        `INSERT INTO payments (
          id, payment_number, fee_id, student_id, amount, payment_date,
          payment_method, transaction_reference, remarks, received_by
        ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?)`,
        paymentUuid,
        paymentNumber,
        feeId,
        calc.fee.student_id,
        amount,
        paymentMethod,
        transactionReference || null,
        remarks || null,
        receivedBy
      );

      // 3. Recalculate and update fee status
      const newPaid = calc.paidAmount + amount;
      const newRemaining = calc.totalAmount - newPaid;
      const today = new Date().toISOString().split('T')[0];

      let newStatus: FeeStatus = 'PARTIALLY_PAID';
      if (newRemaining <= 0) {
        newStatus = 'PAID';
      } else if (calc.fee.due_date < today) {
        newStatus = 'OVERDUE';
      }

      await db.runAsync(
        "UPDATE fees SET status = ?, updated_at = datetime('now') WHERE id = ?",
        newStatus,
        feeId
      );

      await AuditRepository.log('RECORD_PAYMENT', 'payments', paymentUuid, userId, null, {
        payment_number: paymentNumber,
        fee_id: feeId,
        amount,
        new_status: newStatus
      });
    });

    const payment = await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE id = ?', paymentUuid);
    if (!payment) throw new Error('Failed to record payment.');
    return payment;
  },

  async getFeePayments(feeId: string): Promise<Payment[]> {
    const db = await getDatabase();
    return db.getAllAsync<Payment>(
      'SELECT * FROM payments WHERE fee_id = ? ORDER BY payment_date DESC, created_at DESC',
      feeId
    );
  },

  async getSummaryMetrics(): Promise<{
    totalCollection: number;
    pendingTotal: number;
    overdueTotal: number;
  }> {
    const db = await getDatabase();
    const paidRow = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(amount) AS total FROM payments');
    const totalFeesRow = await db.getFirstAsync<{ total: number | null }>(
      "SELECT SUM(amount) AS total FROM fees WHERE status != 'WAIVED'"
    );
    const overdueRow = await db.getFirstAsync<{ total: number | null }>(
      "SELECT SUM(amount) AS total FROM fees WHERE status = 'OVERDUE'"
    );

    const totalPaid = paidRow?.total || 0;
    const totalFees = totalFeesRow?.total || 0;
    const pendingTotal = Math.max(0, totalFees - totalPaid);

    return {
      totalCollection: totalPaid,
      pendingTotal,
      overdueTotal: overdueRow?.total || 0
    };
  }
};
