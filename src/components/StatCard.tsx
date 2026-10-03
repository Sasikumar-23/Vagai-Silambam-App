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
        {icon && <View style={[styles.iconChip, { backgroundColor: `${accentColor}14` }]}>{icon}</View>}
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
    borderColor: theme.colors.borderLight,
    borderLeftWidth: 3,
    minWidth: 140,
    flex: 1,
    ...theme.shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 29,
    fontWeight: theme.typography.weights.black,
    letterSpacing: theme.typography.letterSpacing.tight,
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
