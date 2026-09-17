import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  titleTa?: string;
  message: string;
  messageTa?: string;
  confirmLabel?: string;
  confirmLabelTa?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  titleTa,
  message,
  messageTa,
  confirmLabel,
  confirmLabelTa,
  cancelLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { language, t } = useI18n();

  if (!visible) return null;

  const displayTitle = language === 'ta' && titleTa ? titleTa : title;
  const displayMsg = language === 'ta' && messageTa ? messageTa : message;
  const displayConfirm = language === 'ta' && confirmLabelTa ? confirmLabelTa : (confirmLabel || t.common.confirm);
  const displayCancel = cancelLabel || t.common.cancel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <AlertTriangle size={28} color={isDestructive ? theme.colors.crimson : theme.colors.gold} />
          </View>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.message}>{displayMsg}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{displayCancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: isDestructive ? theme.colors.crimson : theme.colors.primary },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{displayConfirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
