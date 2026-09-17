import * as SQLite from 'expo-sqlite';
import { getDatabase, resetDatabaseConnection } from './connection';

export interface BackupData {
  version: string;
  timestamp: string;
  app: string;
  tables: {
    users: any[];
    roles: any[];
    user_roles: any[];
    training_centers: any[];
    instructors: any[];
    students: any[];
    parents_guardians: any[];
    student_guardians: any[];
    attendance_sessions: any[];
    attendance: any[];
    event_types: any[];
    events: any[];
    event_custom_fields: any[];
    event_custom_field_options: any[];
    event_custom_field_values: any[];
    event_registrations: any[];
    event_results: any[];
    fee_types: any[];
    fees: any[];
    payments: any[];
    uniform_types: any[];
    uniforms: any[];
    achievements: any[];
    certificates: any[];
    documents: any[];
    notifications: any[];
    notification_recipients: any[];
    audit_logs: any[];
    settings: any[];
  };
}

export async function createDatabaseBackup(): Promise<BackupData> {
  const db = await getDatabase();

  const [
    users, roles, user_roles, training_centers, instructors,
    students, parents_guardians, student_guardians,
    attendance_sessions, attendance,
    event_types, events, event_custom_fields, event_custom_field_options, event_custom_field_values,
    event_registrations, event_results,
    fee_types, fees, payments,
    uniform_types, uniforms,
    achievements, certificates, documents,
    notifications, notification_recipients,
    audit_logs, settings
  ] = await Promise.all([
    db.getAllAsync('SELECT * FROM users'),
    db.getAllAsync('SELECT * FROM roles'),
    db.getAllAsync('SELECT * FROM user_roles'),
    db.getAllAsync('SELECT * FROM training_centers'),
    db.getAllAsync('SELECT * FROM instructors'),
    db.getAllAsync('SELECT * FROM students'),
    db.getAllAsync('SELECT * FROM parents_guardians'),
    db.getAllAsync('SELECT * FROM student_guardians'),
    db.getAllAsync('SELECT * FROM attendance_sessions'),
    db.getAllAsync('SELECT * FROM attendance'),
    db.getAllAsync('SELECT * FROM event_types'),
    db.getAllAsync('SELECT * FROM events'),
    db.getAllAsync('SELECT * FROM event_custom_fields'),
    db.getAllAsync('SELECT * FROM event_custom_field_options'),
    db.getAllAsync('SELECT * FROM event_custom_field_values'),
    db.getAllAsync('SELECT * FROM event_registrations'),
    db.getAllAsync('SELECT * FROM event_results'),
    db.getAllAsync('SELECT * FROM fee_types'),
    db.getAllAsync('SELECT * FROM fees'),
    db.getAllAsync('SELECT * FROM payments'),
    db.getAllAsync('SELECT * FROM uniform_types'),
    db.getAllAsync('SELECT * FROM uniforms'),
    db.getAllAsync('SELECT * FROM achievements'),
    db.getAllAsync('SELECT * FROM certificates'),
    db.getAllAsync('SELECT * FROM documents'),
    db.getAllAsync('SELECT * FROM notifications'),
    db.getAllAsync('SELECT * FROM notification_recipients'),
    db.getAllAsync('SELECT * FROM audit_logs'),
    db.getAllAsync('SELECT * FROM settings'),
  ]);

  return {
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    app: 'Vagai Silambam Mobile',
    tables: {
      users, roles, user_roles, training_centers, instructors,
      students, parents_guardians, student_guardians,
      attendance_sessions, attendance,
      event_types, events, event_custom_fields, event_custom_field_options, event_custom_field_values,
      event_registrations, event_results,
      fee_types, fees, payments,
      uniform_types, uniforms,
      achievements, certificates, documents,
      notifications, notification_recipients,
      audit_logs, settings
    }
  };
}

export function validateBackupData(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Invalid backup file format.' };
  }
  if (!data.tables || typeof data.tables !== 'object') {
    return { isValid: false, error: 'Backup is missing tables data.' };
  }
  if (!Array.isArray(data.tables.students)) {
    return { isValid: false, error: 'Backup is missing required students table.' };
  }
  return { isValid: true };
}

export async function restoreDatabaseFromBackup(backup: BackupData): Promise<{ success: boolean; message: string }> {
  const validation = validateBackupData(backup);
  if (!validation.isValid) {
    return { success: false, message: validation.error || 'Invalid backup.' };
  }

  const db = await getDatabase();

  try {
    await db.withTransactionAsync(async () => {
      // Clear data tables in reverse foreign-key order
      await db.execAsync(`
        DELETE FROM notification_recipients;
        DELETE FROM notifications;
        DELETE FROM audit_logs;
        DELETE FROM documents;
        DELETE FROM certificates;
        DELETE FROM achievements;
        DELETE FROM uniforms;
        DELETE FROM uniform_types;
        DELETE FROM payments;
        DELETE FROM fees;
        DELETE FROM fee_types;
        DELETE FROM event_results;
        DELETE FROM event_custom_field_values;
        DELETE FROM event_custom_field_options;
        DELETE FROM event_custom_fields;
        DELETE FROM event_registrations;
        DELETE FROM events;
        DELETE FROM event_types;
        DELETE FROM attendance;
        DELETE FROM attendance_sessions;
        DELETE FROM student_guardians;
        DELETE FROM parents_guardians;
        DELETE FROM students;
        DELETE FROM instructors;
        DELETE FROM training_centers;
        DELETE FROM user_roles;
        DELETE FROM roles;
        DELETE FROM users;
        DELETE FROM settings;
      `);

      const insertTableData = async (tableName: string, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(row);
          await db.runAsync(
            `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
            ...values as any[]
          );
        }
      };

      const t = backup.tables;
      await insertTableData('roles', t.roles);
      await insertTableData('users', t.users);
      await insertTableData('user_roles', t.user_roles);
      await insertTableData('training_centers', t.training_centers);
      await insertTableData('instructors', t.instructors);
      await insertTableData('students', t.students);
      await insertTableData('parents_guardians', t.parents_guardians);
      await insertTableData('student_guardians', t.student_guardians);
      await insertTableData('attendance_sessions', t.attendance_sessions);
      await insertTableData('attendance', t.attendance);
      await insertTableData('event_types', t.event_types);
      await insertTableData('events', t.events);
      await insertTableData('event_custom_fields', t.event_custom_fields);
      await insertTableData('event_custom_field_options', t.event_custom_field_options);
      await insertTableData('event_custom_field_values', t.event_custom_field_values);
      await insertTableData('event_registrations', t.event_registrations);
      await insertTableData('event_results', t.event_results);
      await insertTableData('fee_types', t.fee_types);
      await insertTableData('fees', t.fees);
      await insertTableData('payments', t.payments);
      await insertTableData('uniform_types', t.uniform_types);
      await insertTableData('uniforms', t.uniforms);
      await insertTableData('achievements', t.achievements);
      await insertTableData('certificates', t.certificates);
      await insertTableData('documents', t.documents);
      await insertTableData('notifications', t.notifications);
      await insertTableData('notification_recipients', t.notification_recipients);
      await insertTableData('audit_logs', t.audit_logs);
      await insertTableData('settings', t.settings);

      await db.runAsync(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values)
        VALUES (?, 'system', 'DATABASE_RESTORED', 'database', 'vagai_silambam.db', ?)
      `, 'audit_restore_' + Date.now(), JSON.stringify({ timestamp: new Date().toISOString() }));
    });

    return { success: true, message: 'Database restored successfully!' };
  } catch (error: any) {
    console.error('Failed to restore database:', error);
    return { success: false, message: error.message || 'Database restore failed.' };
  }
}
