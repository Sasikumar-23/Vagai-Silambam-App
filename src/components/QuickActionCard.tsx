import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

interface QuickActionCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  color?: string;
  bg?: string;
}

const QuickActionCardComponent: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  color = theme.colors.primary,
  bg = theme.colors.surface,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const QuickActionCard = React.memo(QuickActionCardComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 56,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 12,
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
});
