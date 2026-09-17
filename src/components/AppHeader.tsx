import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell, Globe, Settings as SettingsIcon, ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { NotificationRepository } from '../repositories/NotificationRepository';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  navigation: any;
  showBack?: boolean;
  onBack?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  navigation,
  showBack = false,
  onBack,
}) => {
  const { language, toggleLanguage, t } = useI18n();
  const { currentRole, currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (currentUser?.id) {
      NotificationRepository.getUnreadCount(currentUser.id)
        .then(count => setUnreadCount(count))
        .catch(() => {});
    }
  }, [currentUser]);

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else if (navigation && typeof navigation.goBack === 'function') {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBackPress}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : (
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          )}

          <View style={styles.titleContainer}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {title || (language === 'ta' ? t.common.appName : 'Vagai Silambam')}
            </Text>
            {subtitle ? (
              <Text style={styles.brandSubtitle} numberOfLines={1}>{subtitle}</Text>
            ) : (
              <View style={styles.rolePill}>
                <ShieldCheck size={12} color={theme.colors.accent} />
                <Text style={styles.roleText}>{currentRole}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionsRow}>
          {/* Language Toggle Button */}
          <TouchableOpacity
            style={styles.langToggleBtn}
            onPress={toggleLanguage}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Language English / Tamil"
          >
            <Globe size={14} color={theme.colors.primary} />
            <Text style={styles.langToggleText}>{language === 'en' ? 'தமிழ்' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={18} color={theme.colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <SettingsIcon size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: theme.colors.surface,
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  titleContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  brandSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.accent,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langToggleBtn: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#93C5FD',
    gap: 4,
  },
  langToggleText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  langBadge: {
    display: 'none',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.colors.crimson,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
});
