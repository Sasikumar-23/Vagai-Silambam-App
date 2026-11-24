import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useI18n } from '../i18n';
import { GoogleSheetsAttendanceService, SyncWaitReason } from '../services/GoogleSheetsAttendanceService';

const MESSAGES: Record<Exclude<SyncWaitReason, ''>, { en: string; ta: string }> = {
  OFFLINE: {
    en: 'They will upload when the internet is back.',
    ta: 'இணையம் வந்ததும் தானாக அனுப்பப்படும்.',
  },
  GOOGLE_NOT_CONNECTED: {
    en: 'The Google Sheet is not connected yet. The academy admin can connect it in the web portal.',
    ta: 'Google Sheet இன்னும் இணைக்கப்படவில்லை. பள்ளி நிர்வாகி இணையப் போர்ட்டலில் இணைக்கலாம்.',
  },
  SUBSCRIPTION: {
    en: 'The plan has expired. Renew it to upload.',
    ta: 'திட்டம் காலாவதியாகிவிட்டது. புதுப்பித்ததும் அனுப்பப்படும்.',
  },
  ACCOUNT: {
    en: 'This account or academy is not active. Ask the academy admin.',
    ta: 'இந்தக் கணக்கு அல்லது பள்ளி செயலில் இல்லை. பள்ளி நிர்வாகியிடம் கேளுங்கள்.',
  },
  SIGN_IN: {
    en: 'Sign in while online to upload.',
    ta: 'அனுப்ப, இணையத்துடன் உள்நுழையுங்கள்.',
  },
};

const UPLOADING = { en: 'Uploading now…', ta: 'இப்போது அனுப்பப்படுகிறது…' };

/** Shows how much attendance is waiting to reach the Google Sheet, and why. Hidden when none is. */
export const AttendanceSyncBanner: React.FC = () => {
  const { language } = useI18n();
  const isFocused = useIsFocused();
  const [state, setState] = useState<{ pending: number; reason: SyncWaitReason }>({ pending: 0, reason: '' });
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    const next = await GoogleSheetsAttendanceService.getSyncState();
    setState(prev => (prev.pending === next.pending && prev.reason === next.reason ? prev : next));
  }, []);

  // A save sends in the background, so look again every few seconds while anything is waiting.
  useEffect(() => {
    if (!isFocused) return;
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [isFocused, refresh]);

  if (state.pending === 0) return null;

  const ta = language === 'ta';
  const message = state.reason ? MESSAGES[state.reason] : UPLOADING;
  const title = ta
    ? `${state.pending} வருகைப் பதிவுகள் Google Sheet-க்கு அனுப்பக் காத்திருக்கின்றன`
    : `${state.pending} attendance ${state.pending === 1 ? 'record is' : 'records are'} waiting to upload to the Google Sheet`;

  const uploadNow = async () => {
    setUploading(true);
    try {
      await GoogleSheetsAttendanceService.syncPendingQueue();
    } finally {
      await refresh();
      setUploading(false);
    }
  };

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <CloudOff size={18} color="#92400E" />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{ta ? message.ta : message.en}</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={uploadNow}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={ta ? 'இப்போது அனுப்பு' : 'Upload now'}
      >
        {uploading ? <ActivityIndicator size="small" color="#92400E" /> : <RefreshCw size={16} color="#92400E" />}
        <Text style={styles.buttonText}>{ta ? 'அனுப்பு' : 'Upload'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  textBlock: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#78350F' },
  body: { fontSize: 12, color: '#92400E', marginTop: 2 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  buttonText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
});
