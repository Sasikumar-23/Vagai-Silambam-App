import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  IndianRupee, Shirt, Award, FileText, Bell, Users,
  Settings as SettingsIcon, LogOut, ChevronRight, Shield, RefreshCw
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { UserRole } from '../models/types';

export default function MoreScreen({ navigation }: any) {
  const { t, language } = useI18n();
  const { currentRole, currentUser, logout, switchRole } = useAuth();

  const handleRoleSwitch = (role: UserRole) => {
    switchRole(role);
    Alert.alert('Role Switched', `Switched active profile to ${role}. Navigating to dashboard.`);
    navigation.navigate('DashboardTab');
  };

  const menuItems = [
    {
      title: t.nav.fees,
      subtitle: 'Fee register, student dues and payment receipts',
      icon: <Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.gold }}>₹</Text>,
      bg: '#FEF3C7',
      screen: 'Fees',
    },
    {
      title: t.nav.uniforms,
      subtitle: 'Silambam kurta, dhoti, sticks, and grading sashes',
      icon: <Shirt size={22} color={theme.colors.primary} />,
      bg: theme.colors.primaryMuted,
      screen: 'Uniforms',
    },
    {
      title: t.nav.achievements,
      subtitle: 'State medals, trophies, and tournament honours',
      icon: <Award size={22} color="#B45309" />,
      bg: '#FEF3C7',
      screen: 'Achievements',
    },
    {
      title: t.nav.certificates,
      subtitle: 'Belt grading and competition merit certificates',
      icon: <FileText size={22} color={theme.colors.purple} />,
      bg: '#F3E8FF',
      screen: 'Certificates',
    },
    {
      title: t.nav.reports,
      subtitle: 'Export attendance, fee collection and roster CSVs',
      icon: <FileText size={22} color={theme.colors.accent} />,
      bg: '#E6F9F1',
      screen: 'Reports',
    },
    {
      title: t.nav.notifications,
      subtitle: 'System alerts, fee reminders and attendance logs',
      icon: <Bell size={22} color={theme.colors.primary} />,
      bg: theme.colors.primaryMuted,
      screen: 'Notifications',
    },
    {
      title: t.settings.title,
      subtitle: 'Organization details, language, SQLite backup & restore',
      icon: <SettingsIcon size={22} color={theme.colors.textSecondary} />,
      bg: theme.colors.surfaceSubtle,
      screen: 'Settings',
    },
  ];

  const demoRoles: UserRole[] = ['ADMIN', 'INSTRUCTOR', 'STAFF'];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} title={t.nav.more} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {currentUser?.full_name_en ? currentUser.full_name_en.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>
              {language === 'ta' && currentUser?.full_name_ta ? currentUser.full_name_ta : currentUser?.full_name_en}
            </Text>
            <Text style={styles.userRoleBadge}>{currentRole}</Text>
          </View>
        </View>

        {/* Role Switcher Section (Great for pair programming / testing) */}
        <View style={styles.roleSwitchSection}>
          <Text style={styles.roleSwitchTitle}>Switch Active Role (Testing & Verification)</Text>
          <View style={styles.rolesRow}>
            {demoRoles.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, currentRole === r && styles.roleChipActive]}
                onPress={() => handleRoleSwitch(r)}
              >
                <Text style={[styles.roleChipText, currentRole === r && styles.roleChipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: item.bg }]}>
                {item.icon}
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            navigation.replace('Login');
          }}
        >
          <LogOut size={18} color={theme.colors.crimson} />
          <Text style={styles.logoutText}>{t.common.logout}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  userRoleBadge: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '800',
    marginTop: 2,
  },
  roleSwitchSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  roleSwitchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  menuSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    gap: 12,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.crimsonLight,
    borderWidth: 1,
    borderColor: '#FECDD3',
    gap: 8,
  },
  logoutText: {
    color: theme.colors.crimson,
    fontSize: 14,
    fontWeight: '800',
  },
});
