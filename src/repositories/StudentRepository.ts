import { getDatabase } from '../database/connection';
import { Student, ParentGuardian, StudentGuardian, TrainingLevel, StudentStatus, Gender } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface StudentFilters {
  query?: string;
  status?: StudentStatus;
  level?: TrainingLevel;
  trainingCenterId?: string;
  instructorId?: string;
  gender?: Gender;
}

export const StudentRepository = {
  async generateStudentId(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `VS-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_id: string | null }>(
      "SELECT MAX(student_id) as max_id FROM students WHERE student_id LIKE ?",
      `${prefix}%`
    );

    let nextNumber = 1;
    if (row && row.max_id) {
      const parts = row.max_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  },

  async createStudent(
    studentData: Omit<Student, 'id' | 'student_id' | 'created_at' | 'updated_at'>,
    guardianData?: Omit<ParentGuardian, 'id' | 'created_at' | 'updated_at'>,
    userId: string = 'system'
  ): Promise<Student> {
    const db = await getDatabase();
    const studentIdCode = await this.generateStudentId();
    const studentUuid = 'stu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    await db.withTransactionAsync(async () => {
      // 1. Insert student
      await db.runAsync(
        `INSERT INTO students (
          id, student_id, roll_number, name_en, name_ta, photo_url, date_of_birth,
          gender, contact_number, address_en, address_ta, joining_date, student_status,
          medical_notes, previous_silambam_experience, training_level, training_center_id, instructor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        studentUuid,
        studentIdCode,
        studentData.roll_number || null,
        studentData.name_en,
        studentData.name_ta || studentData.name_en,
        studentData.photo_url || null,
        studentData.date_of_birth,
        studentData.gender,
        studentData.contact_number,
        studentData.address_en || null,
        studentData.address_ta || null,
        studentData.joining_date || new Date().toISOString().split('T')[0],
        studentData.student_status || 'ACTIVE',
        studentData.medical_notes || null,
        studentData.previous_silambam_experience || null,
        studentData.training_level || 'BEGINNER',
        studentData.training_center_id,
        studentData.instructor_id || null
      );

      // 2. Insert guardian if provided
      if (guardianData && guardianData.name_en && guardianData.phone) {
        const guardianUuid = 'pg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        await db.runAsync(
          `INSERT INTO parents_guardians (
            id, name_en, name_ta, relationship, phone, alternate_phone, email, address_en, address_ta
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          guardianUuid,
          guardianData.name_en,
          guardianData.name_ta || null,
          guardianData.relationship || 'Father',
          guardianData.phone,
          guardianData.alternate_phone || null,
          guardianData.email || null,
          guardianData.address_en || null,
          guardianData.address_ta || null
        );

        await db.runAsync(
          `INSERT INTO student_guardians (id, student_id, guardian_id, is_primary, is_emergency_contact)
           VALUES (?, ?, ?, 1, 1)`,
          'sg_' + Date.now(),
          studentUuid,
          guardianUuid
        );
      }

      await AuditRepository.log('CREATE_STUDENT', 'students', studentUuid, userId, null, {
        student_id: studentIdCode,
        name_en: studentData.name_en,
        training_level: studentData.training_level
      });
    });

    const created = await this.getStudentById(studentUuid);
    if (!created) throw new Error('Failed to retrieve newly created student.');
    return created;
  },

  async updateStudent(
    id: string,
    studentData: Partial<Student>,
    userId: string = 'system'
  ): Promise<Student> {
    const db = await getDatabase();
    const existing = await this.getStudentById(id);
    if (!existing) throw new Error(`Student ${id} not found.`);

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof Student)[] = [
      'roll_number', 'name_en', 'name_ta', 'photo_url', 'date_of_birth',
      'gender', 'contact_number', 'address_en', 'address_ta', 'joining_date',
      'student_status', 'medical_notes', 'previous_silambam_experience',
      'training_level', 'training_center_id', 'instructor_id'
    ];

    for (const key of allowedKeys) {
      if (studentData[key] !== undefined) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(studentData[key]);
      }
    }

    if (fieldsToUpdate.length > 0) {
      fieldsToUpdate.push("updated_at = datetime('now')");
      values.push(id);

      await db.runAsync(
        `UPDATE students SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
        ...values
      );

      await AuditRepository.log('UPDATE_STUDENT', 'students', id, userId, existing, studentData);
    }

    const updated = await this.getStudentById(id);
    if (!updated) throw new Error(`Student ${id} not found after update.`);
    return updated;
  },

  async getStudentById(id: string): Promise<Student | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Student>('SELECT * FROM students WHERE id = ? OR student_id = ?', id, id);
  },

  async getStudentGuardians(studentId: string): Promise<ParentGuardian[]> {
    const db = await getDatabase();
    return db.getAllAsync<ParentGuardian>(
      `SELECT pg.*, sg.is_primary, sg.is_emergency_contact
       FROM parents_guardians pg
       JOIN student_guardians sg ON pg.id = sg.guardian_id
       WHERE sg.student_id = ?
       ORDER BY sg.is_primary DESC`,
      studentId
    );
  },

  async getAllStudents(filters?: StudentFilters, limit: number = 200, offset: number = 0): Promise<Student[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.query && filters.query.trim().length > 0) {
      const q = `%${filters.query.trim()}%`;
      conditions.push(`(name_en LIKE ? OR name_ta LIKE ? OR student_id LIKE ? OR roll_number LIKE ? OR contact_number LIKE ?)`);
      params.push(q, q, q, q, q);
    }

    if (filters?.status) {
      conditions.push('student_status = ?');
      params.push(filters.status);
    }

    if (filters?.level) {
      conditions.push('training_level = ?');
      params.push(filters.level);
    }

    if (filters?.trainingCenterId) {
      conditions.push('training_center_id = ?');
      params.push(filters.trainingCenterId);
    }

    if (filters?.instructorId) {
      conditions.push('instructor_id = ?');
      params.push(filters.instructorId);
    }

    if (filters?.gender) {
      conditions.push('gender = ?');
      params.push(filters.gender);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM students ${whereClause} ORDER BY name_en ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.getAllAsync<Student>(sql, ...params);
  },

  async getStudentAttendanceRate(studentId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ attendance_percentage: number | null }>(
      'SELECT attendance_percentage FROM student_attendance_summary WHERE student_id = ?',
      studentId
    );
    return row?.attendance_percentage ?? 0;
  },

  async getAttendanceRatesBatch(studentIds: string[]): Promise<Record<string, number>> {
    if (!studentIds || studentIds.length === 0) return {};
    const db = await getDatabase();
    const placeholders = studentIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ student_id: string; attendance_percentage: number | null }>(
      `SELECT student_id, attendance_percentage FROM student_attendance_summary WHERE student_id IN (${placeholders})`,
      ...studentIds
    );
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.student_id] = row.attendance_percentage ?? 0;
    }
    return map;
  },

  async deleteStudent(id: string, userId: string = 'system'): Promise<void> {
    const db = await getDatabase();
    const existing = await this.getStudentById(id);
    if (!existing) return;

    // We deactivate student to preserve historic attendance and fee audit records
    await db.runAsync(
      "UPDATE students SET student_status = 'INACTIVE', updated_at = datetime('now') WHERE id = ?",
      id
    );

    await AuditRepository.log('DEACTIVATE_STUDENT', 'students', id, userId, existing, { student_status: 'INACTIVE' });
  }
};
