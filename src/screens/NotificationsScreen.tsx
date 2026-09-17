import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Bell, CheckCheck, AlertCircle, IndianRupee, Calendar, Shield, ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { NotificationRepository, NotificationWithReadStatus } from '../repositories/NotificationRepository';

export default function NotificationsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentUser } = useAuth();

  const [notifications, setNotifications] = useState<NotificationWithReadStatus[]>([]);

  useEffect(() => {
    if (isFocused && currentUser?.id) {
      loadNotifications();
    }
  }, [isFocused, currentUser]);

  const loadNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const list = await NotificationRepository.getUserNotifications(currentUser.id);
      setNotifications(list);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  const handleNotificationPress = async (item: NotificationWithReadStatus) => {
    // 1. Mark as read immediately in database and state
    if (!item.is_read) {
      try {
        await NotificationRepository.markAsRead(item.recipient_id);
        setNotifications(prev =>
          prev.map(n => (n.id === item.id ? { ...n, is_read: 1 } : n))
        );
      } catch (err) {
        console.warn('Could not mark notification read:', err);
      }
    }

    // 2. Redirect to the target screen based on notification type and reference
    const type = (item.notification_type || '').toLowerCase();
    const refType = (item.reference_type || '').toLowerCase();
    const refId = item.reference_id;

    if (type === 'fee' || refType === 'fee') {
      if (refId) {
        navigation.navigate('CollectPayment', { feeId: refId });
      } else {
        navigation.navigate('Fees');
      }
    } else if (type === 'event' || refType === 'event') {
      if (refId) {
        navigation.navigate('EventDetail', { eventId: refId });
      } else {
        navigation.navigate('Events');
      }
    } else if (type === 'attendance' || refType === 'attendance') {
      navigation.navigate('MainTabs', { screen: 'AttendanceTab' });
    } else if (type === 'student' || refType === 'student') {
      if (refId) {
        navigation.navigate('StudentDetail', { studentId: refId });
      } else {
        navigation.navigate('MainTabs', { screen: 'StudentsTab' });
      }
    } else if (type === 'certificate' || refType === 'certificate') {
      navigation.navigate('Certificates');
    } else if (type === 'uniform' || refType === 'uniform') {
      navigation.navigate('Uniforms');
    } else if (type === 'achievement' || refType === 'achievement') {
      navigation.navigate('Achievements');
    } else {
      // Default: Navigate to Dashboard tab
      navigation.navigate('MainTabs', { screen: 'DashboardTab' });
    }
  };

  const handleMarkAll = async () => {
    if (!currentUser?.id) return;
    await NotificationRepository.markAllAsRead(currentUser.id);
    loadNotifications();
  };

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'fee':
        return <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.gold }}>₹</Text>;
      case 'event':
        return <Calendar size={20} color={theme.colors.purple} />;
      case 'attendance':
        return <AlertCircle size={20} color={theme.colors.accent} />;
      default:
        return <Bell size={20} color={theme.colors.primary} />;
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} showBack={true} title={t.notifications.title} />

      {notifications.length > 0 && (
        <View style={styles.topActionsBar}>
          <Text style={styles.unreadCount}>
            {notifications.filter(n => !n.is_read).length} Unread
          </Text>
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll}>
            <CheckCheck size={16} color={theme.colors.primary} />
            <Text style={styles.markAllText}>{t.notifications.markAllRead}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>{getIcon(item.notification_type)}</View>
            <View style={styles.content}>
              <Text style={styles.title}>
                {language === 'ta' && item.title_ta ? item.title_ta : item.title_en}
              </Text>
              <Text style={styles.message}>
                {language === 'ta' && item.message_ta ? item.message_ta : item.message_en}
              </Text>
              <Text style={styles.date}>{item.created_at}</Text>
            </View>
            <ChevronRight size={16} color={theme.colors.textMuted} />
            {!item.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Bell size={32} color={theme.colors.textMuted} />}
            title={t.notifications.noNotifications}
            subtitle="Updates regarding sessions, fees, and championship events will appear here."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  notifCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: '#F6F9FF',
    borderColor: '#C5D8F1',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  message: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  date: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.crimson,
  },
});
