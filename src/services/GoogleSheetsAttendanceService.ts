import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsRepository } from '../repositories/SettingsRepository';

export interface SheetAttendanceRecord {
  attendance_id: string;
  date: string; // YYYY-MM-DD
  student_id: string; // e.g. VS001
  student_name: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
  remarks?: string;
  marked_by: string;
  created_at: string; // HH:mm or ISO
}

export interface AttendanceDashboardStats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  leaveToday: number;
  attendancePercentage: number;
}

export interface StudentAttendanceMetrics {
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  percentage: number;
}

const STORAGE_KEY_ATTENDANCE_RECORDS = '@vagai_google_sheets_attendance_records';
const STORAGE_KEY_PENDING_SYNC_QUEUE = '@vagai_google_sheets_sync_queue';
const SETTING_SHEETS_WEBHOOK_URL = 'google_sheets_webhook_url';
const SETTING_SHEETS_SPREADSHEET_ID = 'google_sheets_spreadsheet_id';
const SETTING_LATE_ATTENDANCE_WEIGHT = 'attendance_late_weight';

export const GoogleSheetsAttendanceService = {
  /**
   * Get configured Google Sheets Webhook URL or Apps Script URL
   */
  async getWebhookUrl(): Promise<string> {
    return await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
  },

  /**
   * Save Webhook URL / Apps Script URL
   */
  async setWebhookUrl(url: string): Promise<void> {
    await SettingsRepository.setSetting(SETTING_SHEETS_WEBHOOK_URL, url.trim());
  },

  /**
   * Get Spreadsheet ID
   */
  async getSpreadsheetId(): Promise<string> {
    return await SettingsRepository.getSetting(SETTING_SHEETS_SPREADSHEET_ID, '1VagaiSilambamAttendanceSheetId');
  },

  /**
   * Save Spreadsheet ID
   */
  async setSpreadsheetId(id: string): Promise<void> {
    await SettingsRepository.setSetting(SETTING_SHEETS_SPREADSHEET_ID, id.trim());
  },

  /**
   * Fetch all attendance records from local cache
   */
  async getAllLocalRecords(): Promise<SheetAttendanceRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_ATTENDANCE_RECORDS);
      if (!data) return [];
      return JSON.parse(data) as SheetAttendanceRecord[];
    } catch (e) {
      console.warn('Error reading local attendance records:', e);
      return [];
    }
  },

  /**
   * Save attendance batch to Google Sheets & local cache with DUPLICATE PREVENTION (student_id + date)
   */
  async saveAttendanceBatch(
    records: Array<{
      student_id: string;
      student_name: string;
      date: string;
      status: 'Present' | 'Absent' | 'Late' | 'Leave';
      remarks?: string;
      marked_by?: string;
    }>,
    markedBy: string = 'Instructor'
  ): Promise<{ savedCount: number; updatedCount: number; syncedToGoogle: boolean }> {
    const existing = await this.getAllLocalRecords();
    const timeNow = new Date().toTimeString().slice(0, 5); // HH:mm
    const nowIso = new Date().toISOString();

    let savedCount = 0;
    let updatedCount = 0;

    const updatedList = [...existing];
    const newItemsToPush: SheetAttendanceRecord[] = [];

    for (const item of records) {
      const existingIdx = updatedList.findIndex(
        r => r.student_id === item.student_id && r.date === item.date
      );

      const recordId = `ATT_${item.date.replace(/-/g, '')}_${item.student_id}`;

      const newRecord: SheetAttendanceRecord = {
        attendance_id: recordId,
        date: item.date,
        student_id: item.student_id,
        student_name: item.student_name,
        status: item.status,
        remarks: item.remarks || '',
        marked_by: item.marked_by || markedBy,
        created_at: timeNow,
      };

      if (existingIdx >= 0) {
        // Update existing record for that student + date
        updatedList[existingIdx] = newRecord;
        updatedCount++;
      } else {
        // Insert new unique record
        updatedList.push(newRecord);
        savedCount++;
      }

      newItemsToPush.push(newRecord);
    }

    // Save to local cache
    await AsyncStorage.setItem(STORAGE_KEY_ATTENDANCE_RECORDS, JSON.stringify(updatedList));

    // Push to Google Sheets API / Webhook
    let syncedToGoogle = false;
    const webhookUrl = await this.getWebhookUrl();

    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record_attendance',
            sheetName: 'Attendance',
            records: newItemsToPush,
            timestamp: nowIso,
          }),
        });

        if (response.ok) {
          syncedToGoogle = true;
        } else {
          await this.addToSyncQueue(newItemsToPush);
        }
      } catch (err) {
        console.warn('Network error pushing to Google Sheets, queued offline:', err);
        await this.addToSyncQueue(newItemsToPush);
      }
    } else {
      // Queued for when webhook is configured
      await this.addToSyncQueue(newItemsToPush);
    }

    return { savedCount, updatedCount, syncedToGoogle };
  },

  /**
   * Add records to offline sync queue
   */
  async addToSyncQueue(records: SheetAttendanceRecord[]): Promise<void> {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
      const queue: SheetAttendanceRecord[] = queueRaw ? JSON.parse(queueRaw) : [];

      for (const rec of records) {
        const idx = queue.findIndex(q => q.student_id === rec.student_id && q.date === rec.date);
        if (idx >= 0) {
          queue[idx] = rec;
        } else {
          queue.push(rec);
        }
      }

      await AsyncStorage.setItem(STORAGE_KEY_PENDING_SYNC_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to update sync queue:', e);
    }
  },

  /**
   * Get pending offline sync queue count
   */
  async getPendingSyncCount(): Promise<number> {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
      if (!queueRaw) return 0;
      const queue = JSON.parse(queueRaw);
      return Array.isArray(queue) ? queue.length : 0;
    } catch {
      return 0;
    }
  },

  /**
   * Flush pending offline sync queue to Google Sheets
   */
  async syncPendingQueue(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      return { success: false, syncedCount: 0, error: 'Google Sheets Webhook URL is not configured in Settings.' };
    }

    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
      if (!queueRaw) return { success: true, syncedCount: 0 };
      const queue: SheetAttendanceRecord[] = JSON.parse(queueRaw);
      if (queue.length === 0) return { success: true, syncedCount: 0 };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_queue',
          sheetName: 'Attendance',
          records: queue,
        }),
      });

      if (response.ok) {
        await AsyncStorage.removeItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
        return { success: true, syncedCount: queue.length };
      } else {
        return { success: false, syncedCount: 0, error: `Server responded with ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, syncedCount: 0, error: err.message || 'Sync failed.' };
    }
  },

  /**
   * Query attendance records for a specific date from Google Sheets / Local Cache
   */
  async getAttendanceForDate(date: string): Promise<Record<string, SheetAttendanceRecord>> {
    const all = await this.getAllLocalRecords();
    const map: Record<string, SheetAttendanceRecord> = {};
    for (const r of all) {
      if (r.date === date) {
        map[r.student_id] = r;
      }
    }
    return map;
  },

  /**
   * Query attendance records for a specific student across all dates
   */
  async getAttendanceForStudent(studentId: string): Promise<SheetAttendanceRecord[]> {
    const all = await this.getAllLocalRecords();
    return all.filter(r => r.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Dynamic Calculation: Attendance Percentage & Metrics for a student
   * Formula: (Present + (Late * LateWeight)) / Total Sessions * 100
   */
  async calculateStudentMetrics(studentId: string): Promise<StudentAttendanceMetrics> {
    const records = await this.getAttendanceForStudent(studentId);
    if (records.length === 0) {
      return {
        totalSessions: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        leaveCount: 0,
        percentage: 100,
      };
    }

    const presentCount = records.filter(r => r.status === 'Present').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;
    const lateCount = records.filter(r => r.status === 'Late').length;
    const leaveCount = records.filter(r => r.status === 'Leave').length;

    const lateWeightRaw = await SettingsRepository.getSetting(SETTING_LATE_ATTENDANCE_WEIGHT, '1.0');
    const lateWeight = parseFloat(lateWeightRaw) || 1.0;

    const effectivePresent = presentCount + (lateCount * lateWeight);
    const totalSessions = records.length;
    const percentage = totalSessions > 0 ? Math.round((effectivePresent / totalSessions) * 100) : 100;

    return {
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      percentage: Math.min(100, Math.max(0, percentage)),
    };
  },

  /**
   * Dynamic Calculation: Today's Dashboard Metrics from Google Sheets records
   */
  async getDashboardAttendanceStats(date: string, totalActiveStudents: number): Promise<AttendanceDashboardStats> {
    const dateRecords = await this.getAttendanceForDate(date);
    const records = Object.values(dateRecords);

    const presentToday = records.filter(r => r.status === 'Present').length;
    const absentToday = records.filter(r => r.status === 'Absent').length;
    const lateToday = records.filter(r => r.status === 'Late').length;
    const leaveToday = records.filter(r => r.status === 'Leave').length;

    const totalMarked = records.length;
    const attendancePercentage = totalMarked > 0
      ? Math.round(((presentToday + lateToday) / totalMarked) * 100)
      : 0;

    return {
      totalStudents: totalActiveStudents,
      presentToday,
      absentToday,
      lateToday,
      leaveToday,
      attendancePercentage,
    };
  },

  /**
   * Test connection to Google Sheets Webhook
   */
  async testConnection(url?: string): Promise<{ success: boolean; message: string }> {
    const targetUrl = url || (await this.getWebhookUrl());
    if (!targetUrl) {
      return { success: false, message: 'No Google Sheets URL configured.' };
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          sheetName: 'Attendance_Settings',
          appName: 'Vagai Silambam Attendance App',
        }),
      });

      if (response.ok) {
        return { success: true, message: 'Successfully connected to Google Spreadsheet "Vagai Silambam Attendance"!' };
      } else {
        return { success: false, message: `Server responded with HTTP status ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection test failed.' };
    }
  },

  /**
   * Generates Google Apps Script template code for user to paste into their Google Spreadsheet
   */
  getGoogleAppsScriptTemplate(): string {
    return `/**
 * VAGAI SILAMBAM — Combined Google Sheets (Attendance) + Google Drive (Photos/Docs) Script
 * Paste this in: Extensions > Apps Script in your "Vagai Silambam Attendance" Spreadsheet.
 * Deploy as Web App (Execute as: Me, Who has access: Anyone).
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. PING ACTION
    if (data.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'ok', 
        message: 'Vagai Silambam Backend & Drive Connected' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. GOOGLE DRIVE FOLDER INITIALIZATION
    if (data.action === 'drive_init_folders') {
      var rootFolderName = data.rootFolderName || 'Vagai Silambam';
      var rootIter = DriveApp.getFoldersByName(rootFolderName);
      var rootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(rootFolderName);

      function getOrCreateSubFolder(parent, name) {
        var iter = parent.getFoldersByName(name);
        return iter.hasNext() ? iter.next() : parent.createFolder(name);
      }

      var attendanceFolder = getOrCreateSubFolder(rootFolder, 'Student Attendance');
      var photosFolder = getOrCreateSubFolder(rootFolder, 'Student Photos');
      var certsFolder = getOrCreateSubFolder(rootFolder, 'Certificates');
      var docsFolder = getOrCreateSubFolder(rootFolder, 'Student Documents');
      var eventsFolder = getOrCreateSubFolder(rootFolder, 'Event Documents');
      var otherFolder = getOrCreateSubFolder(rootFolder, 'Other Files');

      var folderConfig = {
        rootFolderId: rootFolder.getId(),
        rootFolderName: rootFolderName,
        studentAttendanceFolderId: attendanceFolder.getId(),
        studentPhotosFolderId: photosFolder.getId(),
        certificatesFolderId: certsFolder.getId(),
        studentDocumentsFolderId: docsFolder.getId(),
        eventDocumentsFolderId: eventsFolder.getId(),
        otherFilesFolderId: otherFolder.getId(),
        webViewLink: rootFolder.getUrl()
      };

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Google Drive folders created and verified successfully.',
        folders: folderConfig 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. GOOGLE DRIVE FILE UPLOAD (ATTENDANCE / PHOTOS / CERTIFICATES)
    if (data.action === 'drive_upload') {
      var rootFolder = DriveApp.getFoldersByName('Vagai Silambam').next();
      var targetFolder = rootFolder;
      if (data.folderType === 'attendance') {
        targetFolder = rootFolder.getFoldersByName('Student Attendance').next();
      } else if (data.folderType === 'photos') {
        targetFolder = rootFolder.getFoldersByName('Student Photos').next();
      } else if (data.folderType === 'certificates') {
        targetFolder = rootFolder.getFoldersByName('Certificates').next();
      }

      var decoded = Utilities.base64Decode(data.base64Data);
      var blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName || 'file');
      var file = targetFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        fileId: file.getId(),
        viewUrl: file.getUrl(),
        downloadUrl: file.getDownloadUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ATTENDANCE RECORDING & BATCH SYNC
    var sheet = ss.getSheetByName(data.sheetName || 'Attendance');
    if (!sheet) {
      sheet = ss.insertSheet(data.sheetName || 'Attendance');
      sheet.appendRow(['attendance_id', 'date', 'student_id', 'student_name', 'status', 'remarks', 'marked_by', 'created_at']);
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#0F4C81').setFontColor('#FFFFFF');
    }

    if (data.action === 'record_attendance' || data.action === 'sync_queue') {
      var records = data.records || [];
      var existingData = sheet.getDataRange().getValues();
      
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        var foundRow = -1;
        
        // Duplicate check: student_id + date
        for (var r = 1; r < existingData.length; r++) {
          if (existingData[r][1] == rec.date && existingData[r][2] == rec.student_id) {
            foundRow = r + 1;
            break;
          }
        }
        
        var rowValues = [
          rec.attendance_id,
          rec.date,
          rec.student_id,
          rec.student_name,
          rec.status,
          rec.remarks || '',
          rec.marked_by || 'Instructor',
          rec.created_at || new Date().toLocaleTimeString()
        ];
        
        if (foundRow > 0) {
          sheet.getRange(foundRow, 1, 1, 8).setValues([rowValues]);
        } else {
          sheet.appendRow(rowValues);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', processed: records.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🚀 1-CLICK MANUAL SETUP FUNCTION
 * Select "setupVagaiSilambamDrive" in the Apps Script top toolbar and click "▶ Run".
 * It will automatically create all Google Drive folders and format your spreadsheet sheets!
 */
function setupVagaiSilambamDrive() {
  var rootFolderName = 'Vagai Silambam';
  var rootIter = DriveApp.getFoldersByName(rootFolderName);
  var rootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(rootFolderName);

  function getOrCreateSubFolder(parent, name) {
    var iter = parent.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : parent.createFolder(name);
  }

  var attFolder = getOrCreateSubFolder(rootFolder, 'Student Attendance');
  var photosFolder = getOrCreateSubFolder(rootFolder, 'Student Photos');
  var certsFolder = getOrCreateSubFolder(rootFolder, 'Certificates');
  var docsFolder = getOrCreateSubFolder(rootFolder, 'Student Documents');
  var eventsFolder = getOrCreateSubFolder(rootFolder, 'Event Documents');
  var otherFolder = getOrCreateSubFolder(rootFolder, 'Other Files');

  // Format Attendance Sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['attendance_id', 'date', 'student_id', 'student_name', 'status', 'remarks', 'marked_by', 'created_at']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#0F4C81').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // Format Summary Sheet
  var summarySheet = ss.getSheetByName('Attendance_Summary') || ss.insertSheet('Attendance_Summary');
  if (summarySheet.getLastRow() === 0) {
    summarySheet.appendRow(['Metric', 'Count / Value', 'Updated At']);
    summarySheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#059669').setFontColor('#FFFFFF');
    summarySheet.setFrozenRows(1);
  }

  // Format Settings Sheet
  var settingsSheet = ss.getSheetByName('Attendance_Settings') || ss.insertSheet('Attendance_Settings');
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['Setting Key', 'Setting Value']);
    settingsSheet.appendRow(['Root Folder ID', rootFolder.getId()]);
    settingsSheet.appendRow(['Root Folder URL', rootFolder.getUrl()]);
    settingsSheet.appendRow(['Attendance Folder ID', attFolder.getId()]);
    settingsSheet.appendRow(['Photos Folder ID', photosFolder.getId()]);
    settingsSheet.appendRow(['Certificates Folder ID', certsFolder.getId()]);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#475569').setFontColor('#FFFFFF');
    settingsSheet.setFrozenRows(1);
  }

  Logger.log('====================================================');
  Logger.log('✅ VAGAI SILAMBAM GOOGLE DRIVE SETUP COMPLETED!');
  Logger.log('📁 Root Folder URL: ' + rootFolder.getUrl());
  Logger.log('📊 Student Attendance Folder: ' + attFolder.getId());
  Logger.log('📷 Student Photos Folder: ' + photosFolder.getId());
  Logger.log('📜 Certificates Folder: ' + certsFolder.getId());
  Logger.log('====================================================');
}`;
  }
};
