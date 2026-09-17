import { getDatabase } from '../database/connection';
import { AttendanceSession, AttendanceRecord, AttendanceStatus, Student } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface AttendanceBatchItem {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export const AttendanceRepository = {
  async getOrCreateSession(
    trainingCenterId: string,
    sessionDate: string,
    sessionName: string = 'Daily Silambam Training',
    instructorId?: string,
    startTime: string = '06:00',
    endTime: string = '08:00'
  ): Promise<AttendanceSession> {
    const db = await getDatabase();

    const existing = await db.getFirstAsync<AttendanceSession>(
      `SELECT * FROM attendance_sessions 
       WHERE training_center_id = ? AND session_date = ? AND session_name = ?`,
      trainingCenterId,
      sessionDate,
      sessionName
    );

    if (existing) return existing;

    const sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await db.runAsync(
      `INSERT INTO attendance_sessions (
        id, training_center_id, instructor_id, session_date, start_time, end_time, session_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      trainingCenterId,
      instructorId || null,
      sessionDate,
      startTime,
      endTime,
      sessionName
    );

    const created = await db.getFirstAsync<AttendanceSession>(
      'SELECT * FROM attendance_sessions WHERE id = ?',
      sessionId
    );
    if (!created) throw new Error('Failed to create attendance session.');
    return created;
  },

  async getSessionAttendance(sessionId: string): Promise<Record<string, { status: AttendanceStatus; remarks?: string }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ student_id: string; status: AttendanceStatus; remarks: string | null }>(
      'SELECT student_id, status, remarks FROM attendance WHERE session_id = ?',
      sessionId
    );

    const map: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    for (const r of rows) {
      map[r.student_id] = { status: r.status, remarks: r.remarks || undefined };
    }
    return map;
  },

  async saveBatchAttendance(
    sessionId: string,
    records: AttendanceBatchItem[],
    markedBy: string = 'system'
  ): Promise<{ savedCount: number }> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const item of records) {
        const recordUuid = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        // INSERT OR REPLACE with UNIQUE(session_id, student_id)
        await db.runAsync(
          `INSERT INTO attendance (id, session_id, student_id, status, remarks, marked_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(session_id, student_id) DO UPDATE SET
             status = excluded.status,
             remarks = excluded.remarks,
             marked_by = excluded.marked_by,
             updated_at = datetime('now')`,
          recordUuid,
          sessionId,
          item.studentId,
          item.status,
          item.remarks || null,
          markedBy
        );
      }

      await AuditRepository.log('SAVE_BATCH_ATTENDANCE', 'attendance', sessionId, markedBy, null, {
        record_count: records.length,
        timestamp: new Date().toISOString()
      });
    });

    return { savedCount: records.length };
  },

  async getTodayAttendanceSummary(centerId?: string): Promise<{
    present: number;
    absent: number;
    late: number;
    leave: number;
    total: number;
  }> {
    const db = await getDatabase();
    const today = new Date().toISOString().split('T')[0];

    const centerClause = centerId ? 'AND ses.training_center_id = ?' : '';
    const params = centerId ? [today, centerId] : [today];

    const row = await db.getFirstAsync<{
      present: number;
      absent: number;
      late: number;
      leave: number;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS present,
        COALESCE(SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent,
        COALESCE(SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END), 0) AS late,
        COALESCE(SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END), 0) AS leave
       FROM attendance_sessions ses
       JOIN attendance a ON ses.id = a.session_id
       WHERE ses.session_date = ? ${centerClause}`,
      ...params
    );

    const present = row?.present ?? 0;
    const absent = row?.absent ?? 0;
    const late = row?.late ?? 0;
    const leave = row?.leave ?? 0;

    return {
      present,
      absent,
      late,
      leave,
      total: present + absent + late + leave
    };
  },

  async getAttendanceHistory(filters?: {
    date?: string;
    studentId?: string;
    trainingCenterId?: string;
    status?: AttendanceStatus;
  }, limit: number = 100): Promise<any[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.date) {
      conditions.push('ses.session_date = ?');
      params.push(filters.date);
    }

    if (filters?.studentId) {
      conditions.push('a.student_id = ?');
      params.push(filters.studentId);
    }

    if (filters?.trainingCenterId) {
      conditions.push('ses.training_center_id = ?');
      params.push(filters.trainingCenterId);
    }

    if (filters?.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT 
        a.id, a.status, a.remarks, a.created_at,
        ses.session_date, ses.start_time, ses.session_name,
        s.id as student_uuid, s.student_id as student_code, s.name_en, s.name_ta,
        tc.name_en as center_name_en, tc.name_ta as center_name_ta,
        inst.name_en as instructor_name_en, inst.name_ta as instructor_name_ta
      FROM attendance a
      JOIN attendance_sessions ses ON a.session_id = ses.id
      JOIN students s ON a.student_id = s.id
      JOIN training_centers tc ON ses.training_center_id = tc.id
      LEFT JOIN instructors inst ON ses.instructor_id = inst.id
      ${whereClause}
      ORDER BY ses.session_date DESC, ses.start_time DESC
      LIMIT ?
    `;
    params.push(limit);

    return db.getAllAsync<any>(sql, ...params);
  }
};
