import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { api, ApiError, AttendanceBatchItem } from './ApiClient';
import { TokenStore } from './TokenStore';

export interface SheetAttendanceRecord {
  attendance_id: string;
  date: string; // YYYY-MM-DD
  student_id: string; // e.g. VS001
  student_name: string;
  session_name?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
  remarks?: string;
  marked_by: string;
  created_at: string; // HH:mm or ISO
  owner_id?: string; // the signed-in person who queued it; only they upload it
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

const STORAGE_KEY_SYNC_REASON = '@vagai_attendance_sync_reason';

// Why attendance is still waiting, so the screen can say what to do about it. '' while it is
// simply on its way.
export type SyncWaitReason = '' | 'OFFLINE' | 'GOOGLE_NOT_CONNECTED' | 'SUBSCRIPTION' | 'ACCOUNT' | 'SIGN_IN';

const BATCH_SIZE = 500;   // the server takes up to 1000 rows per request
const MAX_QUEUE = 5000;   // keeps the queue well inside AsyncStorage's per-item limit

// Refusals the academy can fix (connect Google, renew, reactivate the account): keep the
// records until then.
const WAIT_CODES: Record<string, SyncWaitReason> = {
  GOOGLE_NOT_CONNECTED: 'GOOGLE_NOT_CONNECTED',
  ATTENDANCE_SHEET_NOT_CONFIGURED: 'GOOGLE_NOT_CONNECTED',
  TRIAL_EXPIRED: 'SUBSCRIPTION',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION',
  NO_SUBSCRIPTION: 'SUBSCRIPTION',
  ORGANIZATION_SUSPENDED: 'ACCOUNT',
  LICENSE_REVOKED: 'ACCOUNT',
  ACCOUNT_DISABLED: 'ACCOUNT',
  SIGNED_OUT: 'SIGN_IN',
  SESSION_EXPIRED: 'SIGN_IN',
};

// null means the server refused the records for good: drop them. They are still saved on the
// phone either way. Only a plain bad request lands here; anything that might work later waits.
function waitReason(err: unknown): SyncWaitReason | null {
  if (!(err instanceof ApiError)) return 'OFFLINE';
  if (WAIT_CODES[err.code]) return WAIT_CODES[err.code];
  if (err.isNetworkError || err.status === 408 || err.status === 429 || err.status >= 500) return 'OFFLINE';
  // 404/405: the server has not been updated with the upload endpoint yet.
  if (err.status === 404 || err.status === 405) return 'OFFLINE';
  if (err.status === 401) return 'SIGN_IN';
  if (err.status === 402 || err.status === 403) return 'ACCOUNT';
  return null;
}

const keyOf = (r: SheetAttendanceRecord) => `${r.date}|${r.session_name || ''}|${r.student_id}`;

const sameRecord = (a: SheetAttendanceRecord, b: SheetAttendanceRecord) =>
  keyOf(a) === keyOf(b) && a.status === b.status && (a.remarks || '') === (b.remarks || '') && a.created_at === b.created_at;

// Trimmed to the server's limits, so one long remark cannot get a row refused.
const toPayload = (r: SheetAttendanceRecord): AttendanceBatchItem => ({
  student_id: r.student_id.slice(0, 60),
  student_name: (r.student_name || r.student_id).slice(0, 200),
  date: r.date,
  session_name: (r.session_name || 'Daily Training').slice(0, 120),
  status: r.status,
  remarks: r.remarks ? r.remarks.slice(0, 500) : null,
});

async function readQueue(): Promise<SheetAttendanceRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
  const queue = raw ? JSON.parse(raw) : [];
  return Array.isArray(queue) ? queue : [];
}

async function writeReason(reason: SyncWaitReason): Promise<void> {
  if (reason) await AsyncStorage.setItem(STORAGE_KEY_SYNC_REASON, reason);
  else await AsyncStorage.removeItem(STORAGE_KEY_SYNC_REASON);
}

// Every read-change-write of the queue runs one at a time, so a save during a sync is never
// overwritten by the sync's own write.
let queueLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => undefined);
  return run;
}

// Records queued before owners were recorded belong to whoever is signed in.
let queueOwner: string | null = null;
const ownedBy = (owner: string | null) => (r: SheetAttendanceRecord) => !r.owner_id || r.owner_id === owner;

type SyncResult = { success: boolean; syncedCount: number; error?: string };
let syncInFlight: Promise<SyncResult> | null = null;
let syncAgain = false;
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

  /** Set by AuthContext whenever someone signs in or out. */
  setQueueOwner(userId: string | null): void {
    queueOwner = userId;
  },

  /**
   * Take Attendance hands a saved session over here. It goes into the outbox first, so a
   * closed app or a dropped signal cannot lose it, and is then sent in the background.
   */
  async queueSession(
    records: Array<{
      student_id: string;
      student_name: string;
      date: string;
      session_name: string;
      status: 'Present' | 'Absent' | 'Late' | 'Leave';
      remarks?: string;
    }>,
    markedBy: string
  ): Promise<void> {
    const createdAt = new Date().toISOString();
    await this.addToSyncQueue(
      records.map(r => ({
        attendance_id: `ATT_${r.date.replace(/-/g, '')}_${r.student_id}`,
        ...r,
        remarks: r.remarks || '',
        marked_by: markedBy,
        created_at: createdAt,
        owner_id: queueOwner ?? undefined,
      }))
    );
    void this.syncPendingQueue();
  },

  /**
   * Add records to the outbox. Marking the same student in the same session again replaces
   * the waiting record instead of adding a second one.
   */
  async addToSyncQueue(records: SheetAttendanceRecord[]): Promise<void> {
    try {
      await withQueueLock(async () => {
        const queue = await readQueue();
        for (const rec of records) {
          const idx = queue.findIndex(q => keyOf(q) === keyOf(rec));
          if (idx >= 0) {
            queue[idx] = rec;
          } else {
            queue.push(rec);
          }
        }
        // Past the cap, the oldest waiting records go first; every record is still on the phone.
        if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
        await AsyncStorage.setItem(STORAGE_KEY_PENDING_SYNC_QUEUE, JSON.stringify(queue));
      });
    } catch (e) {
      console.warn('Failed to update sync queue:', e);
    }
  },

  /**
   * How many of the signed-in person's records are waiting, and why.
   */
  async getSyncState(): Promise<{ pending: number; reason: SyncWaitReason }> {
    try {
      const [queue, reason] = await Promise.all([readQueue(), AsyncStorage.getItem(STORAGE_KEY_SYNC_REASON)]);
      const pending = queue.filter(ownedBy(queueOwner)).length;
      return { pending, reason: pending ? ((reason as SyncWaitReason) || '') : '' };
    } catch {
      return { pending: 0, reason: '' };
    }
  },

  async getPendingSyncCount(): Promise<number> {
    return (await this.getSyncState()).pending;
  },

  /**
   * Send the outbox to the academy's Google Sheet (through the server), and to the Apps
   * Script webhook if one is set up. A call made while a sync is running is not lost: the
   * sync runs once more afterwards, to pick up whatever was queued in the meantime.
   */
  async syncPendingQueue(): Promise<SyncResult> {
    if (syncInFlight) {
      syncAgain = true;
      return syncInFlight;
    }
    syncInFlight = (async () => {
      let result: SyncResult;
      do {
        syncAgain = false;
        result = await this.flushQueueOnce();
      } while (syncAgain && result.success);
      return result;
    })().finally(() => { syncInFlight = null; });
    return syncInFlight;
  },

  async flushQueueOnce(): Promise<SyncResult> {
    try {
      const mine = (await readQueue()).filter(ownedBy(queueOwner));
      if (mine.length === 0) {
        await writeReason('');
        return { success: true, syncedCount: 0 };
      }
      // Signed in offline (no token): uploading would only be refused.
      if (!queueOwner || !(await TokenStore.hasSession())) {
        await writeReason('SIGN_IN');
        return { success: false, syncedCount: 0, error: 'SIGN_IN' };
      }

      const finished: SheetAttendanceRecord[] = [];
      let sent = 0;

      // A row the server calls invalid (422) is found by halving the batch and dropped on its
      // own, instead of taking the rest of the batch with it. Returns why sending stopped, if it did.
      const send = async (batch: SheetAttendanceRecord[]): Promise<SyncWaitReason> => {
        try {
          await api.syncAttendanceBatch(batch.map(toPayload));
          finished.push(...batch);
          sent += batch.length;
          return '';
        } catch (err) {
          if (err instanceof ApiError && err.status === 422) {
            if (batch.length === 1) {
              console.warn('Attendance row refused as invalid; not retried:', batch[0], err);
              finished.push(batch[0]);
              return '';
            }
            const half = Math.ceil(batch.length / 2);
            return (await send(batch.slice(0, half))) || send(batch.slice(half));
          }
          const why = waitReason(err);
          if (why === null) {
            console.warn('Attendance refused by the server; not retried:', err);
            finished.push(...batch);
            return '';
          }
          return why;
        }
      };

      let reason: SyncWaitReason = '';
      for (let i = 0; i < mine.length && !reason; i += BATCH_SIZE) {
        reason = await send(mine.slice(i, i + BATCH_SIZE));
      }

      // The Apps Script webhook, if set up. It answers HTTP 200 even when its script fails, so
      // only a reply that says success counts.
      const webhookUrl = await this.getWebhookUrl();
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_queue', sheetName: 'Attendance', records: mine }),
          });
          const reply = response.ok ? await response.json().catch(() => null) : null;
          if (reply && reply.status === 'success') {
            finished.splice(0, finished.length, ...mine);
            sent = mine.length;
            reason = '';
          }
        } catch (sheetErr) {
          console.warn('Google Sheets webhook error:', sheetErr);
        }
      }

      // Remove what was handled, keeping anything queued while this ran.
      await withQueueLock(async () => {
        const latest = await readQueue();
        const remaining = latest.filter(rec => !finished.some(f => sameRecord(f, rec)));
        if (remaining.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEY_PENDING_SYNC_QUEUE, JSON.stringify(remaining));
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY_PENDING_SYNC_QUEUE);
        }
        await writeReason(remaining.some(ownedBy(queueOwner)) ? reason : '');
      });
      return reason ? { success: false, syncedCount: sent, error: reason } : { success: true, syncedCount: sent };
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
      // Files stay private to the account that owns the folder: student photos and
      // certificates must not be readable by anyone holding the link.

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
      sheet.appendRow(['attendance_id', 'date', 'student_id', 'student_name', 'status', 'remarks', 'marked_by', 'created_at', 'session_name']);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F4C81').setFontColor('#FFFFFF');
    }

    if (data.action === 'record_attendance' || data.action === 'sync_queue') {
      var records = data.records || [];
      var existingData = sheet.getDataRange().getValues();
      
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        var foundRow = -1;
        
        // Duplicate check: student_id + date + session, so morning and evening stay separate rows
        for (var r = 1; r < existingData.length; r++) {
          if (existingData[r][1] == rec.date && existingData[r][2] == rec.student_id &&
              (existingData[r][8] || '') == (rec.session_name || '')) {
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
          rec.created_at || new Date().toLocaleTimeString(),
          rec.session_name || ''
        ];
        
        if (foundRow > 0) {
          sheet.getRange(foundRow, 1, 1, 9).setValues([rowValues]);
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
    sheet.appendRow(['attendance_id', 'date', 'student_id', 'student_name', 'status', 'remarks', 'marked_by', 'created_at', 'session_name']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F4C81').setFontColor('#FFFFFF');
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
