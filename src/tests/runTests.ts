import { getDatabase } from '../database/connection';
import { runMigrations } from '../database/migrations';
import { seedDatabase } from '../database/seed/seedData';
import { StudentRepository } from '../repositories/StudentRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { EventRepository } from '../repositories/EventRepository';
import { FeeRepository } from '../repositories/FeeRepository';
import { UniformRepository } from '../repositories/UniformRepository';
import { AchievementRepository } from '../repositories/AchievementRepository';
import { CertificateRepository } from '../repositories/CertificateRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { UserRepository } from '../repositories/UserRepository';
import { createDatabaseBackup, validateBackupData, restoreDatabaseFromBackup } from '../database/backup';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runAllTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - start });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message || String(e), durationMs: Date.now() - start });
    }
  };

  // 1. Connection & Migrations
  await runTest('1. Database Connection & Schema Migrations', async () => {
    const db = await getDatabase();
    if (!db) throw new Error('Database handle is null');
    await runMigrations();
  });

  // 2. Seed Data Execution
  await runTest('2. Development Seed Data Execution', async () => {
    await seedDatabase(true);
  });

  // 3. Student CRUD & Sequential ID
  await runTest('3. Student CRUD & Safe Sequential ID', async () => {
    const nextId = await StudentRepository.generateStudentId();
    if (!nextId.startsWith('VS-')) throw new Error(`Invalid student ID format: ${nextId}`);

    const newStudent = await StudentRepository.createStudent(
      {
        name_en: 'Test Silambam Student',
        name_ta: 'தேர்வு சிலம்ப மாணவர்',
        date_of_birth: '2012-05-10',
        gender: 'MALE',
        contact_number: '+91 99999 88888',
        joining_date: '2026-09-01',
        student_status: 'ACTIVE',
        training_level: 'BEGINNER',
        training_center_id: 'tc_01',
      },
      {
        name_en: 'Test Guardian',
        name_ta: 'தேர்வு பாதுகாவலர்',
        relationship: 'Father',
        phone: '+91 99999 88888',
      }
    );

    if (newStudent.name_en !== 'Test Silambam Student') throw new Error('Student name mismatch');

    // Verify guardian relationship
    const guardians = await StudentRepository.getStudentGuardians(newStudent.id);
    if (guardians.length === 0) throw new Error('Guardian was not linked to student');

    // Update
    const updated = await StudentRepository.updateStudent(newStudent.id, {
      training_level: 'BASIC',
    });
    if (updated.training_level !== 'BASIC') throw new Error('Update failed');
  });

  // 4. Duplicate Student ID Protection
  await runTest('4. Duplicate Student ID Constraint', async () => {
    const db = await getDatabase();
    try {
      await db.runAsync(
        `INSERT INTO students (id, student_id, name_en, name_ta, date_of_birth, gender, contact_number, training_level, training_center_id)
         VALUES ('dup_1', 'VS-2026-0001', 'Duplicate Name', 'டூப்ளிகேட்', '2010-01-01', 'MALE', '123456', 'BEGINNER', 'tc_01')`
      );
      throw new Error('Expected duplicate student_id error but none occurred.');
    } catch (e: any) {
      if (e.message.includes('Expected duplicate')) throw e;
      // Passed: SQLite correctly threw constraint violation!
    }
  });

  // 5. Attendance Session & Upsert
  await runTest('5. Attendance Session & Mark Batch', async () => {
    const session = await AttendanceRepository.getOrCreateSession('tc_01', '2026-09-09', 'Test Session');
    if (!session) throw new Error('Session creation failed');

    await AttendanceRepository.saveBatchAttendance(
      session.id,
      [
        { studentId: 'stu_01', status: 'PRESENT' },
        { studentId: 'stu_02', status: 'ABSENT' },
      ],
      'test_user'
    );

    const map = await AttendanceRepository.getSessionAttendance(session.id);
    if (map['stu_01']?.status !== 'PRESENT') throw new Error('stu_01 not PRESENT');
    if (map['stu_02']?.status !== 'ABSENT') throw new Error('stu_02 not ABSENT');
  });

  // 6. Duplicate Attendance Prevention (Unique session_id + student_id)
  await runTest('6. Duplicate Attendance Prevention (Updates record cleanly)', async () => {
    const session = await AttendanceRepository.getOrCreateSession('tc_01', '2026-09-09', 'Test Session');
    await AttendanceRepository.saveBatchAttendance(
      session.id,
      [{ studentId: 'stu_01', status: 'LATE', remarks: 'Arrived 15 mins late' }],
      'test_user'
    );

    const map = await AttendanceRepository.getSessionAttendance(session.id);
    if (map['stu_01']?.status !== 'LATE') throw new Error('Expected status to update to LATE');
  });

  // 7. Event Registration & Duplicate Check
  await runTest('7. Event Registration & Duplicate Check', async () => {
    // stu_05 registering for ev_02
    const reg = await EventRepository.registerStudentForEvent('ev_02', 'stu_05', { category: 'Single Stick' });
    if (!reg.registration_code.startsWith('VSE-')) throw new Error('Registration code missing prefix');

    // Duplicate check
    try {
      await EventRepository.registerStudentForEvent('ev_02', 'stu_05', { category: 'Single Stick' });
      throw new Error('Expected duplicate registration error but none occurred.');
    } catch (e: any) {
      if (e.message.includes('Expected duplicate')) throw e;
      // Passed: duplicate prevented!
    }
  });

  // 8. Event Result & Auto Achievement Generation
  await runTest('8. Event Result & Auto Achievement Creation', async () => {
    await EventRepository.recordEventResult(
      'ev_02',
      'stu_05',
      {
        result: 'Winner',
        position: '1st Place',
        medal: 'Gold Medal',
        remarks: 'Excellent weapons technique',
      }
    );

    const achList = await AchievementRepository.getStudentAchievements('stu_05');
    if (achList.length === 0) throw new Error('Achievement record was not auto-generated');
  });

  // 9. Fee Calculation & Overpayment Prevention
  await runTest('9. Fee Calculation & Overpayment Prevention', async () => {
    const fee = await FeeRepository.createFee('stu_03', 'ft_01', 1000, '2026-10-15', 'October Fee');

    // Partial payment ₹400
    await FeeRepository.recordPayment(fee.id, 400, 'UPI', 'Test Accountant');
    let calc = await FeeRepository.getFeeCalculation(fee.id);
    if (calc.paidAmount !== 400 || calc.remainingAmount !== 600) {
      throw new Error(`Calculations wrong: paid=${calc.paidAmount}, remaining=${calc.remainingAmount}`);
    }

    // Overpayment attempt ₹700 (Remaining is ₹600)
    try {
      await FeeRepository.recordPayment(fee.id, 700, 'UPI', 'Test Accountant');
      throw new Error('Expected overpayment error but none occurred.');
    } catch (e: any) {
      if (e.message.includes('Expected overpayment')) throw e;
      // Passed: overpayment rejected!
    }

    // Full payment ₹600
    await FeeRepository.recordPayment(fee.id, 600, 'CASH', 'Test Accountant');
    calc = await FeeRepository.getFeeCalculation(fee.id);
    if (calc.remainingAmount !== 0) throw new Error('Expected remaining amount 0');
  });

  // 10. Uniform Issue
  await runTest('10. Uniform Issue & Number Generation', async () => {
    const uni = await UniformRepository.issueUniform('stu_01', 'ut_01', 'L', 1, 750, 'PAID', 'NEW');
    if (!uni.uniform_number.startsWith('UNI-')) throw new Error('Invalid uniform number');
  });

  // 11. Certificate Issue
  await runTest('11. Certificate Issue & Unique Code', async () => {
    const cert = await CertificateRepository.issueCertificate({
      student_id: 'stu_01',
      certificate_title_en: 'Test Certificate of Merit',
      certificate_title_ta: 'தேர்வு தகுதிச் சான்றிதழ்',
      issue_date: '2026-09-09',
    });
    if (!cert.certificate_number.startsWith('CERT-VS-')) throw new Error('Invalid certificate number');
  });

  // 12. Backup & Restore
  await runTest('12. Database Backup & Restore Validation', async () => {
    const backup = await createDatabaseBackup();
    const validation = validateBackupData(backup);
    if (!validation.isValid) throw new Error('Backup data is invalid: ' + validation.error);

    const restoreRes = await restoreDatabaseFromBackup(backup);
    if (!restoreRes.success) throw new Error('Database restore failed: ' + restoreRes.message);
  });

  // 13. Role Authentication
  await runTest('13. Authentication & Role Presets', async () => {
    const admin = await UserRepository.verifyCredentials('admin', 'admin123');
    if (!admin || admin.role !== 'ADMIN') throw new Error('Admin authentication failed');

    const instructor = await UserRepository.verifyCredentials('instructor', 'inst123');
    if (!instructor || instructor.role !== 'INSTRUCTOR') throw new Error('Instructor auth failed');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
