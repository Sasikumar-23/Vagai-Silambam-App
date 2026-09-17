import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import { theme } from '../theme';

interface BilingualInputFieldProps {
  labelEn: string;
  labelTa: string;
  valueEn: string;
  valueTa: string;
  onChangeEn: (text: string) => void;
  onChangeTa: (text: string) => void;
  placeholderEn?: string;
  placeholderTa?: string;
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}

export const BilingualInputField: React.FC<BilingualInputFieldProps> = ({
  labelEn,
  labelTa,
  valueEn,
  valueTa,
  onChangeEn,
  onChangeTa,
  placeholderEn,
  placeholderTa,
  required = false,
  multiline = false,
  numberOfLines = 1,
}) => {
  return (
    <View style={styles.container}>
      {/* English Individual Field */}
      <View style={styles.fieldBlock}>
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>
            {labelEn} {required && <Text style={styles.required}>*</Text>}
          </Text>
          <View style={styles.langPillEn}>
            <Text style={styles.langPillTextEn}>EN</Text>
          </View>
        </View>
        <TextInput
          mode="outlined"
          value={valueEn}
          onChangeText={onChangeEn}
          placeholder={placeholderEn || `Enter ${labelEn}`}
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          outlineStyle={styles.outline}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>

      {/* Tamil Individual Field */}
      <View style={styles.fieldBlock}>
        <View style={styles.labelRow}>
          <Text style={styles.labelTextTa}>
            {labelTa} {required && <Text style={styles.required}>*</Text>}
          </Text>
          <View style={styles.langPillTa}>
            <Text style={styles.langPillTextTa}>தமிழ்</Text>
          </View>
        </View>
        <TextInput
          mode="outlined"
          value={valueTa}
          onChangeText={onChangeTa}
          placeholder={placeholderTa || `${labelTa} உள்ளிடவும்`}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, styles.tamilInput]}
          outlineStyle={styles.outline}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
    gap: 12,
  },
  fieldBlock: {
    backgroundColor: theme.colors.surface,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  labelTextTa: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064E3B', // Subtle martial forest green for Tamil distinction
  },
  required: {
    color: theme.colors.crimson,
  },
  langPillEn: {
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langPillTextEn: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  langPillTa: {
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langPillTextTa: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.accent,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  tamilInput: {
    // Unicode-compatible rendering
    fontSize: 15,
  },
  outline: {
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
  },
});
