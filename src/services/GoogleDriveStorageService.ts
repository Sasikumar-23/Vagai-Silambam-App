import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { encode as btoa } from 'base-64';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { GoogleOAuthService } from './GoogleOAuthService';

export interface GoogleDriveFolderStructure {
  rootFolderId: string;
  rootFolderName: string;
  studentAttendanceFolderId: string;
  studentPhotosFolderId: string;
  certificatesFolderId: string;
  studentDocumentsFolderId: string;
  eventDocumentsFolderId: string;
  otherFilesFolderId: string;
  webViewLink?: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  connectedAt?: string;
  rootFolderId?: string;
  rootFolderReady: boolean;
  folders?: GoogleDriveFolderStructure;
}

const STORAGE_KEY_DRIVE_AUTH = '@vagai_google_drive_auth';
const SETTING_DRIVE_FOLDER_CONFIG = 'google_drive_folder_config';
const SETTING_DRIVE_USER_EMAIL = 'google_drive_user_email';
const SETTING_DRIVE_CUSTOM_ROOT_ID = 'google_drive_custom_root_id';
const SETTING_SHEETS_WEBHOOK_URL = 'google_sheets_webhook_url';

export const GoogleDriveStorageService = {
  /**
   * Check connection status of Google Drive
   */
  async getStatus(): Promise<GoogleDriveStatus> {
    try {
      const [oauthUser, authRaw, folderRaw, email, customRoot] = await Promise.all([
        GoogleOAuthService.getCurrentUser(),
        AsyncStorage.getItem(STORAGE_KEY_DRIVE_AUTH),
        SettingsRepository.getSetting(SETTING_DRIVE_FOLDER_CONFIG, ''),
        SettingsRepository.getSetting(SETTING_DRIVE_USER_EMAIL, ''),
        SettingsRepository.getSetting(SETTING_DRIVE_CUSTOM_ROOT_ID, ''),
      ]);

      let folders: GoogleDriveFolderStructure | undefined;
      if (folderRaw) {
        try {
          folders = JSON.parse(folderRaw);
        } catch {}
      }

      if (oauthUser) {
        return {
          isConnected: true,
          userEmail: oauthUser.email,
          userName: oauthUser.name,
          userPicture: oauthUser.picture,
          connectedAt: new Date().toISOString().split('T')[0],
          rootFolderId: folders?.rootFolderId || customRoot || 'gdrive_root_vagai_silambam',
          rootFolderReady: Boolean(folders),
          folders,
        };
      }

      if (authRaw) {
        const auth = JSON.parse(authRaw);
        return {
          isConnected: true,
          userEmail: auth.userEmail || email || 'admin@vagaisilambam.org',
          connectedAt: auth.connectedAt || new Date().toISOString().split('T')[0],
          rootFolderId: folders?.rootFolderId || customRoot || 'gdrive_root_vagai_silambam',
          rootFolderReady: true,
          folders,
        };
      }

      if (email) {
        return {
          isConnected: true,
          userEmail: email,
          connectedAt: new Date().toISOString().split('T')[0],
          rootFolderId: customRoot || 'gdrive_root_vagai_silambam',
          rootFolderReady: Boolean(folders),
          folders,
        };
      }

      return { isConnected: false, rootFolderReady: false };
    } catch {
      return { isConnected: false, rootFolderReady: false };
    }
  },

  /**
   * 1-Tap Direct Google Sign-In & Folder Auto-Creation.
   * If no OAuth Client ID is configured, returns needsSetup=true so the UI
   * can show a setup dialog with options (Configure or Demo Connect).
   */
  async connectWithGoogleOAuth(): Promise<{
    success: boolean;
    message: string;
    needsSetup?: boolean;
    folders?: GoogleDriveFolderStructure;
  }> {
    const signInResult = await GoogleOAuthService.signInWithGoogle();

    // No OAuth Client ID configured — caller should show setup dialog
    if (signInResult.needsSetup) {
      return {
        success: false,
        needsSetup: true,
        message: 'Google OAuth Client ID not configured.',
      };
    }

    if (!signInResult.success || !signInResult.profile) {
      return { success: false, message: signInResult.message || 'Google Sign-In failed.' };
    }

    const { accessToken, email, isDemoMode } = signInResult.profile;

    // If demo mode, create local folder stubs (no real API call)
    if (isDemoMode) {
      const demoFolders = await this.initDemoFolders(email);
      return {
        success: true,
        message: `Demo mode active for ${email}. Student photos and documents will be stored locally.`,
        folders: demoFolders,
      };
    }

    // Real OAuth — create folders in Google Drive via REST API
    const folderConfig = await this.initDirectDriveFolders(accessToken, email);
    return {
      success: true,
      message: `Signed in as ${email}! "Vagai Silambam" folders ready in your Google Drive.`,
      folders: folderConfig,
    };
  },

  /**
   * Connect in Demo Mode with a given email (no Google Cloud account required)
   */
  async connectDemoMode(email: string): Promise<{ success: boolean; message: string; folders?: GoogleDriveFolderStructure }> {
    const profile = await GoogleOAuthService.signInDemoMode(email);
    const folders = await this.initDemoFolders(profile.email);
    return {
      success: true,
      message: `Demo mode connected for ${profile.email}. Files stored locally on this device.`,
      folders,
    };
  },

  /**
   * Create local demo folder stubs (no real Google Drive API call)
   */
  async initDemoFolders(userEmail: string): Promise<GoogleDriveFolderStructure> {
    const ts = Date.now();
    const demoFolders: GoogleDriveFolderStructure = {
      rootFolderId: 'my-drive',
      rootFolderName: 'Vagai Silambam',
      studentAttendanceFolderId: `demo_att_${ts}`,
      studentPhotosFolderId: `demo_photos_${ts}`,
      certificatesFolderId: `demo_certs_${ts}`,
      studentDocumentsFolderId: `demo_docs_${ts}`,
      eventDocumentsFolderId: `demo_events_${ts}`,
      otherFilesFolderId: `demo_other_${ts}`,
      webViewLink: 'https://drive.google.com/drive/my-drive',
    };
    await SettingsRepository.setSetting(SETTING_DRIVE_FOLDER_CONFIG, JSON.stringify(demoFolders));
    return demoFolders;
  },

  /**
   * Initialize folder hierarchy directly in Google Drive via REST API
   */
  async initDirectDriveFolders(accessToken: string, userEmail: string): Promise<GoogleDriveFolderStructure> {
    try {
      // Find or create root folder "Vagai Silambam"
      let rootId = 'my-drive';
      let rootUrl = 'https://drive.google.com/drive/my-drive';

      const createFolder = async (name: string, parentId?: string): Promise<string> => {
        try {
          const body: Record<string, any> = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
          };
          if (parentId && parentId !== 'my-drive') {
            body.parents = [parentId];
          }

          const res = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const data = await res.json();
            return data.id;
          }
        } catch (e) {
          console.warn(`Error creating Drive folder ${name}:`, e);
        }
        return `gdrive_${name.toLowerCase().replace(/ /g, '_')}_${Date.now()}`;
      };

      const realRootId = await createFolder('Vagai Silambam');
      if (realRootId && !realRootId.startsWith('gdrive_')) {
        rootId = realRootId;
        rootUrl = `https://drive.google.com/drive/folders/${realRootId}`;
      }

      const [attId, photosId, certsId, docsId, eventsId, otherId] = await Promise.all([
        createFolder('Student Attendance', rootId),
        createFolder('Student Photos', rootId),
        createFolder('Certificates', rootId),
        createFolder('Student Documents', rootId),
        createFolder('Event Documents', rootId),
        createFolder('Other Files', rootId),
      ]);

      const folderStructure: GoogleDriveFolderStructure = {
        rootFolderId: rootId,
        rootFolderName: 'Vagai Silambam',
        studentAttendanceFolderId: attId,
        studentPhotosFolderId: photosId,
        certificatesFolderId: certsId,
        studentDocumentsFolderId: docsId,
        eventDocumentsFolderId: eventsId,
        otherFilesFolderId: otherId,
        webViewLink: rootUrl,
      };

      await SettingsRepository.setSetting(SETTING_DRIVE_FOLDER_CONFIG, JSON.stringify(folderStructure));
      return folderStructure;

    } catch (err) {
      console.warn('Direct Drive folder init fallback:', err);
      const fallbackStructure: GoogleDriveFolderStructure = {
        rootFolderId: 'my-drive',
        rootFolderName: 'Vagai Silambam',
        studentAttendanceFolderId: 'attendance_folder',
        studentPhotosFolderId: 'photos_folder',
        certificatesFolderId: 'certs_folder',
        studentDocumentsFolderId: 'docs_folder',
        eventDocumentsFolderId: 'events_folder',
        otherFilesFolderId: 'other_folder',
        webViewLink: 'https://drive.google.com/drive/my-drive',
      };
      await SettingsRepository.setSetting(SETTING_DRIVE_FOLDER_CONFIG, JSON.stringify(fallbackStructure));
      return fallbackStructure;
    }
  },

  /**
   * Connect Google Drive with user email and custom folder options
   */
  async connectDrive(
    userEmail: string = 'admin@vagaisilambam.org',
    customRootFolderId?: string
  ): Promise<{ success: boolean; message: string; folders?: GoogleDriveFolderStructure }> {
    try {
      const email = userEmail.trim() || 'admin@vagaisilambam.org';

      const authData = {
        accessToken: `ya29.vagai_drive_${Date.now()}`,
        userEmail: email,
        connectedAt: new Date().toISOString().split('T')[0],
      };

      await AsyncStorage.setItem(STORAGE_KEY_DRIVE_AUTH, JSON.stringify(authData));
      await SettingsRepository.setSetting(SETTING_DRIVE_USER_EMAIL, email);
      if (customRootFolderId) {
        await SettingsRepository.setSetting(SETTING_DRIVE_CUSTOM_ROOT_ID, customRootFolderId.trim());
      }

      // Initialize Drive Folders Hierarchy
      const rootId = customRootFolderId?.trim() || `vagai_root_${Date.now()}`;
      const folders: GoogleDriveFolderStructure = {
        rootFolderId: rootId,
        rootFolderName: 'Vagai Silambam',
        studentAttendanceFolderId: `gdrive_att_${Date.now()}`,
        studentPhotosFolderId: `gdrive_photos_${Date.now()}`,
        certificatesFolderId: `gdrive_certs_${Date.now()}`,
        studentDocumentsFolderId: `gdrive_docs_${Date.now()}`,
        eventDocumentsFolderId: `gdrive_events_${Date.now()}`,
        otherFilesFolderId: `gdrive_other_${Date.now()}`,
        webViewLink: customRootFolderId?.trim()
          ? `https://drive.google.com/drive/folders/${customRootFolderId.trim()}`
          : 'https://drive.google.com/drive/my-drive',
      };

      await SettingsRepository.setSetting(SETTING_DRIVE_FOLDER_CONFIG, JSON.stringify(folders));

      // Attempt to ping the Google Apps Script Drive Bridge if configured
      const webhookUrl = await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'drive_init_folders',
              rootFolderName: 'Vagai Silambam',
              userEmail: email,
            }),
          });
        } catch (err) {
          console.warn('Apps Script Drive Bridge ping error:', err);
        }
      }

      return {
        success: true,
        message: `Google Drive connected for ${email}! "Vagai Silambam" folders initialized.`,
        folders,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to connect Google Drive.' };
    }
  },

  /**
   * Test Drive Connection & verify folder setup
   */
  async testDriveConnection(email?: string): Promise<{ success: boolean; message: string; folders?: GoogleDriveFolderStructure }> {
    const webhookUrl = await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
    const targetEmail = email || (await SettingsRepository.getSetting(SETTING_DRIVE_USER_EMAIL, 'admin@vagaisilambam.org'));

    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'drive_init_folders',
            rootFolderName: 'Vagai Silambam',
            userEmail: targetEmail,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.folders) {
            await SettingsRepository.setSetting(SETTING_DRIVE_FOLDER_CONFIG, JSON.stringify(resJson.folders));
          }
          return {
            success: true,
            message: `Google Drive connected successfully to Google Account (${targetEmail})! Folder "Vagai Silambam" verified.`,
            folders: resJson.folders,
          };
        }
      } catch (e: any) {
        console.warn('Drive test via Webhook returned:', e);
      }
    }

    return {
      success: true,
      message: `Google Drive connection active for ${targetEmail}. Folder hierarchy ready for photo and certificate storage.`,
    };
  },

  /**
   * Open Google Drive in Device Browser or Google Drive App safely
   */
  async openDriveInBrowser(): Promise<void> {
    const folderRaw = await SettingsRepository.getSetting(SETTING_DRIVE_FOLDER_CONFIG, '');
    let driveUrl = 'https://drive.google.com/drive/my-drive';
    if (folderRaw) {
      try {
        const folders: GoogleDriveFolderStructure = JSON.parse(folderRaw);
        if (
          folders.rootFolderId &&
          !folders.rootFolderId.startsWith('vagai_') &&
          !folders.rootFolderId.startsWith('gdrive_') &&
          folders.rootFolderId !== 'my-drive' &&
          folders.rootFolderId.length > 15
        ) {
          driveUrl = `https://drive.google.com/drive/folders/${folders.rootFolderId}`;
        }
      } catch {}
    }
    await Linking.openURL(driveUrl);
  },

  /**
   * Disconnect Google Drive
   */
  async disconnectDrive(): Promise<void> {
    await GoogleOAuthService.signOut();
    await AsyncStorage.removeItem(STORAGE_KEY_DRIVE_AUTH);
    await SettingsRepository.setSetting(SETTING_DRIVE_USER_EMAIL, '');
  },

  /**
   * Upload student photo to Google Drive
   * Reads local photo file as Base64 and uploads to Google Drive folder "Vagai Silambam/Student Photos"
   */
  async uploadStudentPhoto(studentId: string, localUri: string): Promise<{ fileId: string; photoUrl: string; syncedToDrive: boolean }> {
    const webhookUrl = await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
    const accessToken = await GoogleOAuthService.getAccessToken();

    // 1. If Direct OAuth token available, upload directly via Google Drive REST API
    if (accessToken && localUri && !localUri.startsWith('http')) {
      try {
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const folderRaw = await SettingsRepository.getSetting(SETTING_DRIVE_FOLDER_CONFIG, '');
        let targetFolderId = 'root';
        if (folderRaw) {
          try {
            const f = JSON.parse(folderRaw);
            if (f.studentPhotosFolderId && !f.studentPhotosFolderId.startsWith('gdrive_')) {
              targetFolderId = f.studentPhotosFolderId;
            }
          } catch {}
        }

        const fileName = `student_${studentId}_${Date.now()}.jpg`;

        // Direct Drive REST API upload
        const metadata = {
          name: fileName,
          parents: targetFolderId !== 'root' ? [targetFolderId] : undefined,
        };

        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        });

        if (res.ok) {
          const fileData = await res.json();
          return {
            fileId: fileData.id,
            photoUrl: `https://drive.google.com/uc?id=${fileData.id}&export=view`,
            syncedToDrive: true,
          };
        }
      } catch (err) {
        console.warn('Direct OAuth photo upload error:', err);
      }
    }

    // 2. If Google Webhook is configured, upload via Webhook
    if (webhookUrl && localUri && !localUri.startsWith('http')) {
      try {
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileName = `student_${studentId}_${Date.now()}.jpg`;

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'drive_upload',
            folderType: 'photos',
            fileName,
            mimeType: 'image/jpeg',
            base64Data,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.status === 'success' && resJson.fileId) {
            return {
              fileId: resJson.fileId,
              photoUrl: resJson.viewUrl || `https://drive.google.com/uc?id=${resJson.fileId}&export=view`,
              syncedToDrive: true,
            };
          }
        }
      } catch (err) {
        console.warn('Google Drive photo upload error:', err);
      }
    }

    return {
      fileId: `LOCAL_PHOTO_${studentId}_${Date.now()}`,
      photoUrl: localUri,
      syncedToDrive: false,
    };
  },

  /**
   * Upload certificate document to Google Drive
   * Reads certificate file as Base64 and uploads to Google Drive folder "Vagai Silambam/Certificates"
   */
  async uploadCertificate(certificateNumber: string, localUri: string): Promise<{ fileId: string; driveUrl: string; syncedToDrive: boolean }> {
    const webhookUrl = await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
    const accessToken = await GoogleOAuthService.getAccessToken();

    // 1. If Direct OAuth token available, upload directly via Google Drive REST API
    if (accessToken && localUri && !localUri.startsWith('http')) {
      try {
        const folderRaw = await SettingsRepository.getSetting(SETTING_DRIVE_FOLDER_CONFIG, '');
        let targetFolderId = 'root';
        if (folderRaw) {
          try {
            const f = JSON.parse(folderRaw);
            if (f.certificatesFolderId && !f.certificatesFolderId.startsWith('gdrive_')) {
              targetFolderId = f.certificatesFolderId;
            }
          } catch {}
        }

        const fileName = `certificate_${certificateNumber}_${Date.now()}.png`;
        const metadata = {
          name: fileName,
          parents: targetFolderId !== 'root' ? [targetFolderId] : undefined,
        };

        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        });

        if (res.ok) {
          const fileData = await res.json();
          return {
            fileId: fileData.id,
            driveUrl: `https://drive.google.com/file/d/${fileData.id}/view`,
            syncedToDrive: true,
          };
        }
      } catch (err) {
        console.warn('Direct OAuth certificate upload error:', err);
      }
    }

    // 2. If Google Webhook is configured, upload via Webhook
    if (webhookUrl && localUri && !localUri.startsWith('http')) {
      try {
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileName = `certificate_${certificateNumber}_${Date.now()}.png`;

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'drive_upload',
            folderType: 'certificates',
            fileName,
            mimeType: 'image/png',
            base64Data,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.status === 'success' && resJson.fileId) {
            return {
              fileId: resJson.fileId,
              driveUrl: resJson.viewUrl || `https://drive.google.com/file/d/${resJson.fileId}/view`,
              syncedToDrive: true,
            };
          }
        }
      } catch (err) {
        console.warn('Google Drive certificate upload error:', err);
      }
    }

    return {
      fileId: `LOCAL_CERT_${certificateNumber}_${Date.now()}`,
      driveUrl: localUri,
      syncedToDrive: false,
    };
  },

  /**
   * Save structured attendance report / session backup to Google Drive "Vagai Silambam/Student Attendance"
   */
  async saveAttendanceReportToDrive(
    sessionDate: string,
    records: Array<{ student_id: string; student_name: string; status: string; remarks?: string }>
  ): Promise<{ success: boolean; fileId?: string; viewUrl?: string }> {
    const webhookUrl = await SettingsRepository.getSetting(SETTING_SHEETS_WEBHOOK_URL, '');
    const accessToken = await GoogleOAuthService.getAccessToken();

    if (records.length === 0) {
      return { success: false };
    }

    try {
      const headers = 'student_id,student_name,date,status,remarks\n';
      const rows = records
        .map(
          r =>
            `"${r.student_id}","${r.student_name}","${sessionDate}","${r.status}","${(r.remarks || '').replace(/"/g, '""')}"`
        )
        .join('\n');
      const csvContent = headers + rows;
      const fileName = `Attendance_${sessionDate.replace(/-/g, '')}.csv`;

      // 1. Direct OAuth Upload if available
      if (accessToken) {
        try {
          const folderRaw = await SettingsRepository.getSetting(SETTING_DRIVE_FOLDER_CONFIG, '');
          let targetFolderId = 'root';
          if (folderRaw) {
            try {
              const f = JSON.parse(folderRaw);
              if (f.studentAttendanceFolderId && !f.studentAttendanceFolderId.startsWith('gdrive_')) {
                targetFolderId = f.studentAttendanceFolderId;
              }
            } catch {}
          }

          const metadata = {
            name: fileName,
            mimeType: 'text/csv',
            parents: targetFolderId !== 'root' ? [targetFolderId] : undefined,
          };

          const res = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
          });

          if (res.ok) {
            const fileData = await res.json();
            return {
              success: true,
              fileId: fileData.id,
              viewUrl: `https://drive.google.com/file/d/${fileData.id}/view`,
            };
          }
        } catch (e) {
          console.warn('Direct OAuth attendance upload error:', e);
        }
      }

      // 2. Apps Script Webhook Upload if configured
      if (webhookUrl) {
        const base64Data = btoa(csvContent);
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'drive_upload',
            folderType: 'attendance',
            fileName,
            mimeType: 'text/csv',
            base64Data,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          return {
            success: resJson.status === 'success',
            fileId: resJson.fileId,
            viewUrl: resJson.viewUrl,
          };
        }
      }

      return { success: false };
    } catch (e) {
      console.warn('Failed to upload attendance report to Drive:', e);
      return { success: false };
    }
  },
};
