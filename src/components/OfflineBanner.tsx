import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Database, WifiOff } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';

export const OfflineBanner: React.FC = () => {
  const { t } = useI18n();

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Database size={16} color={theme.colors.accent} />
        <Text style={styles.text}>{t.common.offlineMode}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>SQLite Local</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#0F2656',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(0, 168, 107, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 107, 0.4)',
  },
  badgeText: {
    color: '#82F3B2',
    fontSize: 10,
    fontWeight: '700',
  },
});
