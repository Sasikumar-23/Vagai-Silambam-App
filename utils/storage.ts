import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, LAST_UPDATE_META_KEY } from './database';

export interface Student {
  id: string;
  name: string;
  dob: string;
  gender: string;
  contact: string;
  guardianName?: string;
  guardianPhone?: string;
  photo?: string;
}

export interface AttendanceRecord {
  [studentId: string]: 'Present' | 'Absent';
}

export interface AttendanceData {
  [date: string]: AttendanceRecord; // date in YYYY-MM-DD
}

const AUTH_KEY = '@auth_user';

interface StudentRow {
  id: string;
  name: string;
  dob: string;
  gender: string;
  contact: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  photo: string | null;
}

interface AttendanceRow {
  date: string;
  student_id: string;
  status: 'Present' | 'Absent';
}

const UPSERT_STUDENT = `
  INSERT INTO students (id, name, dob, gender, contact, guardian_name, guardian_phone, photo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    dob = excluded.dob,
    gender = excluded.gender,
    contact = excluded.contact,
    guardian_name = excluded.guardian_name,
    guardian_phone = excluded.guardian_phone,
    photo = excluded.photo
`;

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    contact: row.contact,
    guardianName: row.guardian_name ?? undefined,
    guardianPhone: row.guardian_phone ?? undefined,
    photo: row.photo ?? undefined,
  };
}

function studentParams(student: Student) {
  return [
    student.id,
    student.name,
    student.dob,
    student.gender,
    student.contact,
    student.guardianName ?? null,
    student.guardianPhone ?? null,
    student.photo ?? null,
  ];
}

export const storage = {
  // Auth Management (session state, kept outside the database)
  async login(userId: string): Promise<void> {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ userId, isLoggedIn: true }));
  },

  async logout(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_KEY);
  },

  async getAuthUser(): Promise<{ userId: string; isLoggedIn: boolean } | null> {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  },

  // Student Management
  async saveStudent(student: Student): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync(UPSERT_STUDENT, studentParams(student));
    } catch (e) {
      console.error('Failed to save student', e);
    }
  },

  async saveAllStudents(students: Student[]): Promise<void> {
    try {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        const ids = students.map(student => student.id);
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(', ');
          await db.runAsync(`DELETE FROM students WHERE id NOT IN (${placeholders})`, ids);
        } else {
          await db.runAsync('DELETE FROM students');
        }

        for (const student of students) {
          await db.runAsync(UPSERT_STUDENT, studentParams(student));
        }
      });
    } catch (e) {
      console.error('Failed to save all students', e);
    }
  },

  async getStudents(): Promise<Student[]> {
    try {
      const db = await getDatabase();
      // Ids are creation timestamps, so this keeps the oldest-first order the screens expect.
      const rows = await db.getAllAsync<StudentRow>(
        'SELECT * FROM students ORDER BY CAST(id AS INTEGER) ASC'
      );
      return rows.map(toStudent);
    } catch (e) {
      console.error('Failed to get students', e);
      return [];
    }
  },

  // Attendance Management
  async saveAttendance(date: string, record: AttendanceRecord): Promise<void> {
    try {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM attendance WHERE date = ?', date);
        for (const [studentId, status] of Object.entries(record)) {
          await db.runAsync(
            'INSERT INTO attendance (date, student_id, status) VALUES (?, ?, ?)',
            date,
            studentId,
            status
          );
        }
        await db.runAsync(
          'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
          LAST_UPDATE_META_KEY,
          Date.now().toString()
        );
      });
    } catch (e) {
      console.error('Failed to save attendance', e);
    }
  },

  async getLastAttendanceUpdate(): Promise<number | null> {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM meta WHERE key = ?',
        LAST_UPDATE_META_KEY
      );
      return row ? parseInt(row.value) : null;
    } catch (e) {
      console.error('Failed to get last attendance update', e);
      return null;
    }
  },

  async getAttendanceByDate(date: string): Promise<AttendanceRecord | null> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<AttendanceRow>(
        'SELECT * FROM attendance WHERE date = ?',
        date
      );
      if (rows.length === 0) return null;

      const record: AttendanceRecord = {};
      for (const row of rows) {
        record[row.student_id] = row.status;
      }
      return record;
    } catch (e) {
      console.error('Failed to get attendance', e);
      return null;
    }
  },

  async getAllAttendance(): Promise<AttendanceData> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<AttendanceRow>('SELECT * FROM attendance');

      const data: AttendanceData = {};
      for (const row of rows) {
        if (!data[row.date]) data[row.date] = {};
        data[row.date][row.student_id] = row.status;
      }
      return data;
    } catch (e) {
      console.error('Failed to get all attendance', e);
      return {};
    }
  },

  // Utility to clear all data (for testing)
  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM attendance; DELETE FROM students; DELETE FROM meta;');
    await AsyncStorage.clear();
  }
};
