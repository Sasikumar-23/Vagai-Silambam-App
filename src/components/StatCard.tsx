import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

const StatCardComponent: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  trend,
  accentColor = theme.colors.primary,
  icon,
}) => {
  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {icon}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {trend && <Text style={styles.trend}>{trend}</Text>}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

export const StatCard = React.memo(StatCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
    minWidth: 140,
    flex: 1,
    ...theme.shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
  },
  trend: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
});
