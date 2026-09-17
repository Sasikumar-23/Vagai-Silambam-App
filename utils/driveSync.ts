import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, Student, AttendanceRecord } from './storage';

const SCRIPT_URL_KEY = '@google_drive_script_url';

export const driveSync = {
  /**
   * Save the Google Apps Script Web App URL
   */
  async saveScriptUrl(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SCRIPT_URL_KEY, url);
    } catch (e) {
      console.error('Failed to save script URL', e);
      throw e;
    }
  },

  /**
   * Get the saved Google Apps Script Web App URL
   */
  async getScriptUrl(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SCRIPT_URL_KEY);
    } catch (e) {
      console.error('Failed to get script URL', e);
      return null;
    }
  },

  /**
   * Sync attendance data to Google Drive via the Apps Script Web App
   */
  async syncToGoogleDrive(
    date: string,
    students: Student[],
    attendance: AttendanceRecord,
    scriptUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const authUser = await storage.getAuthUser();
      const userId = authUser ? authUser.userId : 'Unknown User';

      const records = students.map(student => ({
        name: student.name,
        id: student.id,
        status: attendance[student.id] || 'Not Marked',
      }));

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          records,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (e: any) {
      console.error('Failed to sync to Google Drive', e);
      return { success: false, error: e.message || 'Network error occurred' };
    }
  },

  /**
   * Helper to get the recommended Google Apps Script code for the user
   */
  getAppsScriptTemplateCode(): string {
    return `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var date = data.date;
    var records = data.records; // Array of { name, id, status }
    var userId = data.userId || "Unknown";
    
    // Open or create a spreadsheet
    var folderName = "Vagai Silambam Attendance";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Customize spreadsheet name by login user/email
    var sanitizedUserId = userId.replace(/[^a-zA-Z0-9@.-]/g, "_");
    var fileName = "Attendance_Master_Sheet_" + sanitizedUserId;
    var files = folder.getFilesByName(fileName);
    var spreadsheet;
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      spreadsheet = SpreadsheetApp.create(fileName);
      var file = DriveApp.getFileById(spreadsheet.getId());
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }
    
    // Find or create sheet for the date
    var sheet = spreadsheet.getSheetByName(date);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(date);
    } else {
      sheet.clearContents();
    }
    
    sheet.appendRow(["Student Name", "Student ID", "Status", "Sync Time", "Marked By"]);
    var syncTime = new Date().toLocaleString();
    for (var i = 0; i < records.length; i++) {
      sheet.appendRow([records[i].name, records[i].id, records[i].status, syncTime, userId]);
    }
    
    // Remove default "Sheet1" if it is empty and not the only sheet
    var sheet1 = spreadsheet.getSheetByName("Sheet1");
    if (sheet1 && spreadsheet.getSheets().length > 1 && sheet1.getLastRow() === 0) {
      spreadsheet.deleteSheet(sheet1);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
  }
};
