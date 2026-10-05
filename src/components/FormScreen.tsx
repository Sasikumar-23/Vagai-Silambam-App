import React from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../theme';

interface FormScreenProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-screen form presented over the current screen. These used to be cropped
 * bottom sheets where long forms had almost no room and the keyboard covered
 * the fields.
 */
export const FormScreen: React.FC<FormScreenProps> = ({
  visible,
  title,
  subtitle,
  onClose,
  footer,
  children,
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} accessibilityLabel="Close">
          <ArrowLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <View style={styles.footer}>{footer}</View>
    </KeyboardAvoidingView>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: 52,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: theme.typography.weights.black,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  body: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
});
