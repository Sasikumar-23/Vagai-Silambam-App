import { getDatabase } from '../database/connection';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const ReportService = {
  async getAttendanceReportData(fromDate?: string, toDate?: string): Promise<any[]> {
    const db = await getDatabase();
    return db.getAllAsync<any>(`
      SELECT 
        s.student_id as student_code,
        s.name_en,
        s.name_ta,
        s.training_level,
        tc.name_en as center_name,
        COUNT(a.id) as total_sessions,
        SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END) as leave_count
      FROM students s
      JOIN training_centers tc ON s.training_center_id = tc.id
      LEFT JOIN attendance a ON s.id = a.student_id
      GROUP BY s.id
      ORDER BY s.name_en ASC
    `);
  },

  async getFeeReportData(): Promise<any[]> {
    const db = await getDatabase();
    return db.getAllAsync<any>(`
      SELECT 
        s.student_id as student_code,
        s.name_en,
        s.name_ta,
        f.fee_number,
        ft.name_en as fee_type,
        f.amount as total_amount,
        f.due_date,
        f.status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE fee_id = f.id), 0.0) as paid_amount,
        (f.amount - COALESCE((SELECT SUM(amount) FROM payments WHERE fee_id = f.id), 0.0)) as remaining_amount
      FROM fees f
      JOIN students s ON f.student_id = s.id
      JOIN fee_types ft ON f.fee_type_id = ft.id
      ORDER BY f.due_date DESC
    `);
  },

  async exportReportToCSV(filename: string, headers: string[], rows: (string | number)[][]): Promise<void> {
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];
    const csvContent = csvLines.join('\n');

    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    }
  }
};
