import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { ArrowLeft, Plus, Check, Calendar, Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { BilingualInputField } from '../components/BilingualInputField';
import { EventRepository } from '../repositories/EventRepository';
import { EventType, CustomFieldType } from '../models/types';

interface DynamicFieldDraft {
  nameEn: string;
  nameTa: string;
  type: CustomFieldType;
  required: boolean;
  options: string;
}

export default function CreateEventScreen({ navigation }: any) {
  const { t, language } = useI18n();
  const { currentUser } = useAuth();

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [eventDate, setEventDate] = useState('2026-11-20');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('17:00');
  const [locationEn, setLocationEn] = useState('');
  const [locationTa, setLocationTa] = useState('');
  const [organizerEn, setOrganizerEn] = useState('Vagai Silambam Academy');
  const [organizerTa, setOrganizerTa] = useState('வாகை சிலம்பம் கழகம்');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionTa, setDescriptionTa] = useState('');
  const [eventFee, setEventFee] = useState('0');
  const [maxParticipants, setMaxParticipants] = useState('0');

  // Custom Field Builder
  const [customFields, setCustomFields] = useState<DynamicFieldDraft[]>([]);
  const [newFieldNameEn, setNewFieldNameEn] = useState('');
  const [newFieldNameTa, setNewFieldNameTa] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('DROPDOWN');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const types = await EventRepository.getEventTypes();
      setEventTypes(types);
      if (types.length > 0) setSelectedTypeId(types[0].id);
    } catch (e) {
      console.warn('Failed to load event types:', e);
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldNameEn.trim()) {
      Alert.alert('Required', 'Please enter field name in English.');
      return;
    }
    setCustomFields(prev => [
      ...prev,
      {
        nameEn: newFieldNameEn.trim(),
        nameTa: newFieldNameTa.trim() || newFieldNameEn.trim(),
        type: newFieldType,
        required: true,
        options: newFieldOptions.trim(),
      },
    ]);
    setNewFieldNameEn('');
    setNewFieldNameTa('');
    setNewFieldOptions('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveEvent = async () => {
    if (!nameEn.trim()) {
      Alert.alert('Required', 'Please enter event name in English.');
      return;
    }
    if (!locationEn.trim()) {
      Alert.alert('Required', 'Please enter event location in English.');
      return;
    }

    setSaving(true);
    try {
      const eventCode = `EV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

      const createdEvent = await EventRepository.createEvent(
        {
          event_code: eventCode,
          name_en: nameEn.trim(),
          name_ta: nameTa.trim() || nameEn.trim(),
          event_type_id: selectedTypeId,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          location_en: locationEn.trim(),
          location_ta: locationTa.trim() || locationEn.trim(),
          organizer_en: organizerEn.trim(),
          organizer_ta: organizerTa.trim() || organizerEn.trim(),
          description_en: descriptionEn || undefined,
          description_ta: descriptionTa || undefined,
          registration_required: 1,
          event_fee: parseFloat(eventFee) || 0.0,
          maximum_participants: parseInt(maxParticipants, 10) || 0,
          status: 'OPEN',
        },
        currentUser?.id || 'admin'
      );

      // Save custom fields
      for (let i = 0; i < customFields.length; i++) {
        const cf = customFields[i];
        const optionsList = cf.options ? cf.options.split(',').map(s => s.trim()) : [];
        await EventRepository.addCustomField(
          createdEvent.id,
          {
            field_name_en: cf.nameEn,
            field_name_ta: cf.nameTa,
            field_type: cf.type,
            is_required: cf.required ? 1 : 0,
            sort_order: i + 1,
          },
          optionsList
        );
      }

      Alert.alert('Success', 'Event created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Creation Failed', e.message || 'Error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const tournamentPresets = [
    {
      label: 'State Championship (மாநில போட்டி)',
      nameEn: 'Tamil Nadu State Silambam Championship 2026',
      nameTa: 'தமிழ்நாடு மாநில சிலம்ப சாம்பியன்ஷிப் 2026',
      fee: '350',
      locationEn: 'Nehru Indoor Stadium, Chennai',
      locationTa: 'நேரு உள்விளையாட்டு அரங்கம், சென்னை',
      fields: [
        { nameEn: 'Weapon Category', nameTa: 'ஆயுதப் பிரிவு', type: 'DROPDOWN' as CustomFieldType, required: true, options: 'Single Stick, Double Stick, Kambu Sandai, Surul Vaal, Vel Kambu' },
        { nameEn: 'Age Division', nameTa: 'வயதுப் பிரிவு', type: 'DROPDOWN' as CustomFieldType, required: true, options: 'Sub-Junior (Under 10), Junior (10-14), Senior (15-18), Super Senior (19+)' },
        { nameEn: 'Weight Category', nameTa: 'எடைப் பிரிவு', type: 'DROPDOWN' as CustomFieldType, required: false, options: 'Under 35kg, 35-45kg, 45-55kg, 55kg+' },
      ],
    },
    {
      label: 'Belt Grading Exam (நிலைத் தேர்வு)',
      nameEn: 'Annual Silambam Belt Grading & Rank Examination',
      nameTa: 'ஆண்டு சிலம்ப தகுதித் தேர்வு & நிலை உயர்வு முகாம்',
      fee: '500',
      locationEn: 'Vagai Silambam Central Dojang',
      locationTa: 'வாகை சிலம்பம் தலைமை பயிற்சி கூடம்',
      fields: [
        { nameEn: 'Target Belt Level', nameTa: 'இலக்கு தகுதி நிலை', type: 'DROPDOWN' as CustomFieldType, required: true, options: 'Yellow Belt, Green Belt, Blue Belt, Brown Belt, Black Belt (Asan)' },
        { nameEn: 'Form Examination', nameTa: 'சிலம்ப வரிசைப் பாடம்', type: 'TEXT' as CustomFieldType, required: true, options: '' },
      ],
    },
    {
      label: 'Summer Camp (கோடை பயிற்சி)',
      nameEn: 'Intensive Summer Silambam & Traditional Martial Arts Camp',
      nameTa: 'தீவிர கோடைக்கால சிலம்பம் மற்றும் தற்காப்புக் கலை முகாம்',
      fee: '1500',
      locationEn: 'Camp Grounds, Madurai',
      locationTa: 'பயிற்சி மைதானம், மதுரை',
      fields: [
        { nameEn: 'Diet & Accommodation', nameTa: 'உணவு & தங்குமிடம்', type: 'DROPDOWN' as CustomFieldType, required: true, options: 'Day Scholar, Full Board Resident' },
      ],
    },
  ];

  const applyPreset = (preset: typeof tournamentPresets[0]) => {
    setNameEn(preset.nameEn);
    setNameTa(preset.nameTa);
    setEventFee(preset.fee);
    setLocationEn(preset.locationEn);
    setLocationTa(preset.locationTa);
    setCustomFields(preset.fields);
    Alert.alert('Preset Applied', `Loaded "${preset.nameEn}" templates and registration fields!`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AppHeader navigation={navigation} showBack={true} title={t.events.createEvent} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Tournament / Event Presets */}
        <View style={styles.presetSection}>
          <Text style={styles.presetSectionTitle}>⚡ Quick Tournament & Camp Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {tournamentPresets.map((p, idx) => (
              <TouchableOpacity key={idx} style={styles.templateChip} onPress={() => applyPreset(p)}>
                <Text style={styles.templateChipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionHeader}>1. Event & Tournament Details</Text>

          {/* Event Type Chips */}
          <Text style={styles.fieldLabel}>{t.events.eventType}</Text>
          <View style={styles.typesRow}>
            {eventTypes.map(tItem => (
              <TouchableOpacity
                key={tItem.id}
                style={[styles.typeChip, selectedTypeId === tItem.id && styles.typeChipActive]}
                onPress={() => setSelectedTypeId(tItem.id)}
              >
                <Text style={[styles.typeChipText, selectedTypeId === tItem.id && styles.typeChipTextActive]}>
                  {language === 'ta' && tItem.name_ta ? tItem.name_ta : tItem.name_en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* INDIVIDUAL ENGLISH & TAMIL EVENT NAME */}
          <BilingualInputField
            labelEn="Event / Tournament Name (English)"
            labelTa="நிகழ்வு / போட்டிப் பெயர் (தமிழ்)"
            valueEn={nameEn}
            valueTa={nameTa}
            onChangeEn={setNameEn}
            onChangeTa={setNameTa}
            placeholderEn="e.g. State Silambam Championship 2026"
            placeholderTa="எ.கா. மாநில சிலம்ப சாம்பியன்ஷிப் 2026"
            required
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t.events.date}</Text>
              <TextInput
                mode="outlined"
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="YYYY-MM-DD"
                style={styles.input}
                outlineStyle={styles.outline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t.events.startTime}</Text>
              <TextInput
                mode="outlined"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="09:00"
                style={styles.input}
                outlineStyle={styles.outline}
              />
            </View>
          </View>

          {/* INDIVIDUAL ENGLISH & TAMIL LOCATION */}
          <BilingualInputField
            labelEn="Location / Stadium (English)"
            labelTa="இடம் / அரங்கம் (தமிழ்)"
            valueEn={locationEn}
            valueTa={locationTa}
            onChangeEn={setLocationEn}
            onChangeTa={setLocationTa}
            placeholderEn="e.g. Indoor Stadium, Chennai"
            placeholderTa="எ.கா. உள்விளையாட்டு அரங்கம், சென்னை"
            required
          />

          {/* INDIVIDUAL ENGLISH & TAMIL ORGANIZER */}
          <BilingualInputField
            labelEn="Organizer (English)"
            labelTa="ஏற்பாட்டாளர் (தமிழ்)"
            valueEn={organizerEn}
            valueTa={organizerTa}
            onChangeEn={setOrganizerEn}
            onChangeTa={setOrganizerTa}
            placeholderEn="Organizer Name"
            placeholderTa="ஏற்பாட்டாளர் பெயர்"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t.events.eventFee}</Text>
              <TextInput
                mode="outlined"
                value={eventFee}
                onChangeText={setEventFee}
                placeholder="0"
                keyboardType="numeric"
                style={styles.input}
                outlineStyle={styles.outline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t.events.maxParticipants}</Text>
              <TextInput
                mode="outlined"
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                placeholder="0 for unlimited"
                keyboardType="numeric"
                style={styles.input}
                outlineStyle={styles.outline}
              />
            </View>
          </View>

          {/* INDIVIDUAL ENGLISH & TAMIL DESCRIPTION */}
          <BilingualInputField
            labelEn="Description & Rules (English)"
            labelTa="விளக்கம் மற்றும் விதிகள் (தமிழ்)"
            valueEn={descriptionEn}
            valueTa={descriptionTa}
            onChangeEn={setDescriptionEn}
            onChangeTa={setDescriptionTa}
            placeholderEn="Rules, weapon specifications, dress code, certificates."
            placeholderTa="விதிகள், ஆயுத விவரங்கள், சீருடை மற்றும் சான்றிதழ் விவரங்கள்."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 2. Custom Field Builder */}
        <View style={[styles.formCard, { marginTop: theme.spacing.lg }]}>
          <Text style={styles.sectionHeader}>2. Tournament Registration Fields</Text>
          <Text style={styles.fieldHelper}>
            Configured fields (e.g. Weapon Category, Age Division, Weight Category) will be collected from practitioners upon enrollment.
          </Text>

          {customFields.map((cf, idx) => (
            <View key={idx} style={styles.customFieldItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customFieldName}>{cf.nameEn} ({cf.nameTa})</Text>
                <Text style={styles.customFieldType}>{cf.type} • {cf.options || 'Text Entry'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveCustomField(idx)}>
                <Trash2 size={18} color={theme.colors.crimson} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add New Field Box */}
          <View style={styles.addFieldBox}>
            <Text style={styles.subHeader}>Add Custom Tournament Field</Text>
            <TextInput
              mode="outlined"
              label="Field Name (English)"
              value={newFieldNameEn}
              onChangeText={setNewFieldNameEn}
              placeholder="e.g. Weapon Category / Weight"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="புலப் பெயர் (தமிழ்)"
              value={newFieldNameTa}
              onChangeText={setNewFieldNameTa}
              placeholder="எ.கா. ஆயுதப் பிரிவு / எடை"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Options (comma-separated if dropdown)"
              value={newFieldOptions}
              onChangeText={setNewFieldOptions}
              placeholder="e.g. Single Stick, Double Stick, Surul Vaal"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TouchableOpacity style={styles.addFieldBtn} onPress={handleAddCustomField}>
              <Plus size={16} color={theme.colors.primary} />
              <Text style={styles.addFieldBtnText}>Attach Field to Tournament</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Event Button */}
        <TouchableOpacity
          style={[styles.createSubmitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveEvent}
          disabled={saving}
        >
          <Check size={18} color="#FFFFFF" />
          <Text style={styles.createSubmitText}>
            {saving ? 'Creating Tournament...' : 'Publish Tournament / Event'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  presetSection: {
    backgroundColor: '#FEF3C7',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  presetSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 8,
  },
  templateChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginRight: 6,
  },
  templateChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 6,
  },
  fieldHelper: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  typeChip: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 48,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  outline: {
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
  },
  customFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  customFieldName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  customFieldType: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  addFieldBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  subHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  addFieldBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    height: 44,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addFieldBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  createSubmitBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.xl,
  },
  createSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
