import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import type { AttendanceData, Student } from './storage';

const DATABASE_NAME = 'vagai_silambam.db';

const LEGACY_STUDENTS_KEY = '@students_data';
const LEGACY_ATTENDANCE_KEY = '@attendance_data';
const LEGACY_LAST_UPDATE_KEY = '@last_attendance_update';

const IMPORT_FLAG_KEY = 'async_storage_imported';
export const LAST_UPDATE_META_KEY = 'last_attendance_update';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndPrepare();
  }
  return databasePromise;
}

async function openAndPrepare(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      contact TEXT NOT NULL,
      guardian_name TEXT,
      guardian_phone TEXT,
      photo TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      date TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
      PRIMARY KEY (date, student_id),
      FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await importLegacyData(db);
  return db;
}

async function importLegacyData(db: SQLite.SQLiteDatabase): Promise<void> {
  const imported = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', IMPORT_FLAG_KEY);
  if (imported) return;

  const [studentsRaw, attendanceRaw, lastUpdateRaw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_STUDENTS_KEY),
    AsyncStorage.getItem(LEGACY_ATTENDANCE_KEY),
    AsyncStorage.getItem(LEGACY_LAST_UPDATE_KEY),
  ]);

  const students: Student[] = studentsRaw ? JSON.parse(studentsRaw) : [];
  const attendance: AttendanceData = attendanceRaw ? JSON.parse(attendanceRaw) : {};
  const knownIds = new Set(students.map(student => student.id));

  await db.withTransactionAsync(async () => {
    for (const student of students) {
      await db.runAsync(
        `INSERT OR REPLACE INTO students (id, name, dob, gender, contact, guardian_name, guardian_phone, photo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        student.id,
        student.name,
        student.dob,
        student.gender,
        student.contact,
        student.guardianName ?? null,
        student.guardianPhone ?? null,
        student.photo ?? null
      );
    }

    for (const [date, record] of Object.entries(attendance)) {
      for (const [studentId, status] of Object.entries(record)) {
        // Older releases could leave marks behind for deleted students; the foreign key rejects those.
        if (!knownIds.has(studentId) || (status !== 'Present' && status !== 'Absent')) continue;
        await db.runAsync(
          'INSERT OR REPLACE INTO attendance (date, student_id, status) VALUES (?, ?, ?)',
          date,
          studentId,
          status
        );
      }
    }

    if (lastUpdateRaw) {
      await db.runAsync(
        'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
        LAST_UPDATE_META_KEY,
        lastUpdateRaw
      );
    }

    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', IMPORT_FLAG_KEY, '1');
  });
}
