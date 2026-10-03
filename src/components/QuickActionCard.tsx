import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
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
      <View style={[styles.iconCircle, { backgroundColor: `${color}16` }]}>
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
      <ChevronRight size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

export const QuickActionCard = React.memo(QuickActionCardComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 64,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: 12,
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: theme.typography.weights.heavy,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
});
