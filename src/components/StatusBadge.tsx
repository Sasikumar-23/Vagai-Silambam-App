import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle, Clock, AlertCircle, Award, Shield } from 'lucide-react-native';
import { theme } from '../theme';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'medium' }) => {
  const normalized = status.toUpperCase();

  let bg = theme.colors.surfaceSubtle;
  let text = theme.colors.textSecondary;
  let icon = null;

  switch (normalized) {
    case 'PRESENT':
    case 'PAID':
    case 'ACTIVE':
    case 'COMPLETED':
    case 'CONFIRMED':
    case 'NEW':
      bg = theme.colors.accentLight;
      text = theme.colors.accent;
      icon = <CheckCircle2 size={size === 'small' ? 12 : 14} color={theme.colors.accent} />;
      break;

    case 'ABSENT':
    case 'OVERDUE':
    case 'CANCELLED':
    case 'DAMAGED':
    case 'LOST':
      bg = theme.colors.crimsonLight;
      text = theme.colors.crimson;
      icon = <XCircle size={size === 'small' ? 12 : 14} color={theme.colors.crimson} />;
      break;

    case 'LATE':
    case 'PARTIALLY_PAID':
    case 'PENDING':
    case 'WAITLISTED':
    case 'OPEN':
      bg = theme.colors.goldLight;
      text = theme.colors.gold;
      icon = <Clock size={size === 'small' ? 12 : 14} color={theme.colors.gold} />;
      break;

    case 'LEAVE':
    case 'INACTIVE':
    case 'WAIVED':
    case 'DRAFT':
    case 'CLOSED':
    case 'RETURNED':
      bg = theme.colors.surfaceSubtle;
      text = theme.colors.textMuted;
      icon = <AlertCircle size={size === 'small' ? 12 : 14} color={theme.colors.textMuted} />;
      break;

    case 'WINNER':
    case 'GOLD':
      bg = '#FEF3C7';
      text = '#B45309';
      icon = <Award size={size === 'small' ? 12 : 14} color="#B45309" />;
      break;

    default:
      bg = theme.colors.primaryMuted;
      text = theme.colors.primary;
      icon = <Shield size={size === 'small' ? 12 : 14} color={theme.colors.primary} />;
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'small' && styles.smallBadge]}>
      {icon}
      <Text style={[styles.label, { color: text }, size === 'small' && styles.smallLabel]}>
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    gap: 4,
    alignSelf: 'flex-start',
  },
  smallBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  smallLabel: {
    fontSize: 10,
  },
});
