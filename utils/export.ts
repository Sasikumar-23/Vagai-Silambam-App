import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Student, AttendanceRecord } from './storage';
import { format } from 'date-fns';

export const exportAttendanceToCSV = async (date: string, students: Student[], attendance: AttendanceRecord) => {
  try {
    const header = 'Student Name,Student ID,Status\n';
    const rows = students.map(student => {
      const status = attendance[student.id] || 'Not Marked';
      return `${student.name},${student.id},${status}`;
    }).join('\n');

    const csvContent = header + rows;
    const fileName = `attendance_${date}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: `Export Attendance - ${date}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error: any) {
    console.error('Export error:', error);
    throw error;
  }
};
