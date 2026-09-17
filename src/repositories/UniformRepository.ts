import { getDatabase } from '../database/connection';
import { Uniform, UniformType, UniformCondition, FeeStatus } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface UniformWithDetails extends Uniform {
  student_name_en: string;
  student_name_ta: string;
  student_code: string;
  item_name_en: string;
  item_name_ta: string;
}

export const UniformRepository = {
  async getUniformTypes(): Promise<UniformType[]> {
    const db = await getDatabase();
    return db.getAllAsync<UniformType>('SELECT * FROM uniform_types WHERE is_active = 1 ORDER BY name_en ASC');
  },

  async generateUniformNumber(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `UNI-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_code: string | null }>(
      'SELECT MAX(uniform_number) as max_code FROM uniforms WHERE uniform_number LIKE ?',
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

  async getAllUniforms(): Promise<UniformWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<UniformWithDetails>(`
      SELECT 
        u.*,
        s.name_en AS student_name_en,
        s.name_ta AS student_name_ta,
        s.student_id AS student_code,
        ut.name_en AS item_name_en,
        ut.name_ta AS item_name_ta
      FROM uniforms u
      JOIN students s ON u.student_id = s.id
      JOIN uniform_types ut ON u.uniform_type_id = ut.id
      ORDER BY u.issue_date DESC
    `);
  },

  async issueUniform(
    studentId: string,
    uniformTypeId: string,
    size: string,
    quantity: number,
    amount: number,
    paymentStatus: FeeStatus = 'PENDING',
    condition: UniformCondition = 'NEW',
    remarks?: string,
    userId: string = 'system'
  ): Promise<Uniform> {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero.');
    const db = await getDatabase();
    const id = 'uni_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const uniformNumber = await this.generateUniformNumber();

    await db.runAsync(
      `INSERT INTO uniforms (
        id, uniform_number, student_id, uniform_type_id, size, quantity,
        issue_date, amount, payment_status, condition, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?)`,
      id,
      uniformNumber,
      studentId,
      uniformTypeId,
      size,
      quantity,
      amount,
      paymentStatus,
      condition,
      remarks || null,
      userId
    );

    await AuditRepository.log('ISSUE_UNIFORM', 'uniforms', id, userId, null, {
      uniform_number: uniformNumber,
      student_id: studentId,
      size,
      quantity
    });

    const created = await db.getFirstAsync<Uniform>('SELECT * FROM uniforms WHERE id = ?', id);
    if (!created) throw new Error('Failed to issue uniform.');
    return created;
  },

  async returnUniform(
    id: string,
    condition: UniformCondition = 'RETURNED',
    remarks?: string,
    userId: string = 'system'
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE uniforms 
       SET return_date = date('now'), condition = ?, remarks = COALESCE(?, remarks), updated_at = datetime('now')
       WHERE id = ?`,
      condition,
      remarks || null,
      id
    );

    await AuditRepository.log('RETURN_UNIFORM', 'uniforms', id, userId, null, { condition });
  }
};
