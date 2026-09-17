import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { User, Phone, Award, ChevronRight } from 'lucide-react-native';
import { Student } from '../models/types';
import { theme } from '../theme';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n';

interface StudentCardProps {
  student: Student;
  attendancePercentage?: number;
  onPress: () => void;
  onCall?: () => void;
}

const StudentCardComponent: React.FC<StudentCardProps> = ({
  student,
  attendancePercentage,
  onPress,
  onCall,
}) => {
  const { language } = useI18n();

  // Training Level Color
  let levelColor = theme.colors.primary;
  let levelBg = theme.colors.primaryMuted;

  switch (student.training_level) {
    case 'MASTER':
      levelColor = '#92400E';
      levelBg = '#FEF3C7';
      break;
    case 'ADVANCED':
      levelColor = '#7C3AED';
      levelBg = '#F3E8FF';
      break;
    case 'INTERMEDIATE':
      levelColor = '#00A86B';
      levelBg = '#E6F9F1';
      break;
    case 'BASIC':
      levelColor = '#0284C7';
      levelBg = '#E0F2FE';
      break;
    default:
      levelColor = '#475569';
      levelBg = '#F1F5F9';
      break;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.contentRow}>
        {/* Avatar or Photo */}
        <View style={styles.avatarContainer}>
          {student.photo_url ? (
            <Image source={{ uri: student.photo_url }} style={styles.photo} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: levelBg }]}>
              <Text style={[styles.avatarInitial, { color: levelColor }]}>
                {student.name_en ? student.name_en.charAt(0).toUpperCase() : 'S'}
              </Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.nameEn} numberOfLines={1}>
              {student.name_en}
            </Text>
            <StatusBadge status={student.student_status} size="small" />
          </View>

          {student.name_ta && (
            <Text style={styles.nameTa} numberOfLines={1}>
              {student.name_ta}
            </Text>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.codeText}>{student.student_id}</Text>
            {student.roll_number && (
              <Text style={styles.rollText}>Roll: #{student.roll_number}</Text>
            )}
          </View>

          <View style={styles.footerRow}>
            <View style={[styles.levelBadge, { backgroundColor: levelBg }]}>
              <Award size={12} color={levelColor} />
              <Text style={[styles.levelText, { color: levelColor }]}>
                {student.training_level}
              </Text>
            </View>

            {attendancePercentage !== undefined && (
              <View style={styles.attContainer}>
                <Text style={styles.attLabel}>Att:</Text>
                <Text
                  style={[
                    styles.attValue,
                    {
                      color:
                        attendancePercentage >= 75
                          ? theme.colors.accent
                          : theme.colors.crimson,
                    },
                  ]}
                >
                  {attendancePercentage}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Arrow / Phone action */}
        <View style={styles.actionContainer}>
          {student.contact_number ? (
            <TouchableOpacity
              style={styles.callButton}
              onPress={onCall}
              accessibilityLabel={`Call ${student.name_en}`}
            >
              <Phone size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={20} color={theme.colors.textMuted} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const StudentCard = React.memo(StudentCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    alignSelf: 'center',
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '900',
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  nameEn: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  nameTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  rollText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '800',
  },
  attContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  attValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
