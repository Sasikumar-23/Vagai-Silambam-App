import { getDatabase } from './connection';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { GoogleSheetsAttendanceService } from '../services/GoogleSheetsAttendanceService';
import { AttendanceStatus } from '../models/types';

const IMPORT_FLAG = 'legacy_attendance_imported';

const STATUS_BY_LABEL: Record<string, AttendanceStatus> = {
  Present: 'PRESENT',
  Absent: 'ABSENT',
  Late: 'LATE',
  Leave: 'LEAVE',
};

/**
 * Earlier builds kept attendance only in an AsyncStorage cache, so reports and
 * attendance percentages — which read the `attendance` table — showed zero.
 * This copies those records into the database once, on the next launch.
 */
export async function importLegacyAttendance(): Promise<{ imported: number; skipped: number }> {
  const alreadyImported = await SettingsRepository.getSetting(IMPORT_FLAG, '');
  if (alreadyImported === '1') return { imported: 0, skipped: 0 };

  const records = await GoogleSheetsAttendanceService.getAllLocalRecords();
  if (records.length === 0) {
    await SettingsRepository.setSetting(IMPORT_FLAG, '1');
    return { imported: 0, skipped: 0 };
  }

  const db = await getDatabase();
  const students = await db.getAllAsync<{ id: string; student_id: string; training_center_id: string }>(
    'SELECT id, student_id, training_center_id FROM students'
  );
  const studentByCode = new Map(students.map(s => [s.student_id, s]));

  const byDate = new Map<string, typeof records>();
  for (const record of records) {
    const forDate = byDate.get(record.date) ?? [];
    forDate.push(record);
    byDate.set(record.date, forDate);
  }

  let imported = 0;
  let skipped = 0;

  for (const [date, dayRecords] of byDate) {
    const items = [];
    let centerId = '';

    for (const record of dayRecords) {
      const student = studentByCode.get(record.student_id);
      const status = STATUS_BY_LABEL[record.status];
      // Records for students that no longer exist cannot be attached to a session.
      if (!student || !status) {
        skipped++;
        continue;
      }
      centerId = centerId || student.training_center_id;
      items.push({ studentId: student.id, status, remarks: record.remarks });
    }

    if (items.length === 0) continue;

    const session = await AttendanceRepository.getOrCreateSession(
      centerId,
      date,
      'Daily Silambam Training'
    );
    await AttendanceRepository.saveBatchAttendance(
      session.id,
      items,
      dayRecords[0].marked_by || 'Imported'
    );
    imported += items.length;
  }

  await SettingsRepository.setSetting(IMPORT_FLAG, '1');
  return { imported, skipped };
}
