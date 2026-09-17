import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, ArrowRight, Check, User, Camera, Calendar,
  Shield, Phone, MapPin, HeartPulse, Award, FileText
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { AppHeader } from '../components/AppHeader';
import { BilingualInputField } from '../components/BilingualInputField';
import { StudentRepository } from '../repositories/StudentRepository';
import { TrainingCenterRepository } from '../repositories/TrainingCenterRepository';
import { GoogleDriveStorageService } from '../services/GoogleDriveStorageService';
import { TrainingLevel, Gender, TrainingCenter, Instructor } from '../models/types';

export default function AddStudentWizardScreen({ navigation }: any) {
  const { t, language } = useI18n();

  const [step, setStep] = useState(1);
  const [centers, setCenters] = useState<TrainingCenter[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [generatedId, setGeneratedId] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 1: Personal Details (Individual English and Tamil fields)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [dob, setDob] = useState('2010-01-15');
  const [gender, setGender] = useState<Gender>('MALE');
  const [contactNumber, setContactNumber] = useState('');
  const [addressEn, setAddressEn] = useState('');
  const [addressTa, setAddressTa] = useState('');

  // Step 2: Parent / Guardian
  const [guardianNameEn, setGuardianNameEn] = useState('');
  const [guardianNameTa, setGuardianNameTa] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAltPhone, setGuardianAltPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianAddressEn, setGuardianAddressEn] = useState('');
  const [guardianAddressTa, setGuardianAddressTa] = useState('');

  // Step 3: Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Parent');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Step 4: Training
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>('BEGINNER');
  const [trainingCenterId, setTrainingCenterId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [previousExperience, setPreviousExperience] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [tcList, nextId] = await Promise.all([
        TrainingCenterRepository.getAllCenters(),
        StudentRepository.generateStudentId(),
      ]);
      setCenters(tcList);
      setGeneratedId(nextId);
      if (tcList.length > 0) {
        setTrainingCenterId(tcList[0].id);
        const instList = await TrainingCenterRepository.getAllInstructors(tcList[0].id);
        setInstructors(instList);
        if (instList.length > 0) setInstructorId(instList[0].id);
      }
    } catch (e) {
      console.warn('Failed loading training centers:', e);
    }
  };

  const handleCenterChange = async (centerId: string) => {
    setTrainingCenterId(centerId);
    const instList = await TrainingCenterRepository.getAllInstructors(centerId);
    setInstructors(instList);
    if (instList.length > 0) setInstructorId(instList[0].id);
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera access to capture the student photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Gallery Permission Required', 'Please grant photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open gallery.');
    }
  };

  const handlePhotoAction = () => {
    Alert.alert(
      'Student Photo / மாணவர் புகைப்படம்',
      'Choose an option to upload practitioner photo:',
      [
        {
          text: '📷 Open Camera (புகைப்படம் எடு)',
          onPress: takePhotoWithCamera,
        },
        {
          text: '🖼️ Choose from Gallery (கேலரி)',
          onPress: chooseFromGallery,
        },
        ...(photoUrl
          ? [
              {
                text: '🗑️ Remove Photo',
                style: 'destructive' as const,
                onPress: () => setPhotoUrl(null),
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!nameEn.trim()) {
        Alert.alert('Required Field', 'Please enter student full name in English.');
        return;
      }
      if (!contactNumber.trim()) {
        Alert.alert('Required Field', 'Please enter student contact number.');
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(prev => prev - 1);
    }
  };

  const handleSaveStudent = async () => {
    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl || undefined;
      if (photoUrl && !photoUrl.startsWith('http')) {
        const driveResult = await GoogleDriveStorageService.uploadStudentPhoto(
          rollNumber || generatedId || 'new_student',
          photoUrl
        );
        finalPhotoUrl = driveResult.photoUrl;
      }

      await StudentRepository.createStudent(
        {
          roll_number: rollNumber || undefined,
          name_en: nameEn.trim(),
          name_ta: nameTa.trim() || nameEn.trim(),
          photo_url: finalPhotoUrl,
          date_of_birth: dob,
          gender,
          contact_number: contactNumber.trim(),
          address_en: addressEn || undefined,
          address_ta: addressTa || undefined,
          joining_date: joiningDate,
          student_status: 'ACTIVE',
          medical_notes: medicalNotes || undefined,
          previous_silambam_experience: previousExperience || undefined,
          training_level: trainingLevel,
          training_center_id: trainingCenterId,
          instructor_id: instructorId || undefined,
        },
        guardianNameEn.trim()
          ? {
              name_en: guardianNameEn.trim(),
              name_ta: guardianNameTa.trim() || undefined,
              relationship: guardianRelation,
              phone: guardianPhone.trim() || contactNumber.trim(),
              alternate_phone: guardianAltPhone || undefined,
              email: guardianEmail || undefined,
              address_en: guardianAddressEn || addressEn || undefined,
              address_ta: guardianAddressTa || addressTa || undefined,
            }
          : undefined
      );

      Alert.alert(
        'Success',
        'Silambam student enrolled successfully into local SQLite database!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Error occurred while saving student.');
    } finally {
      setSaving(false);
    }
  };

  const trainingLevels: TrainingLevel[] = ['BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'MASTER'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AppHeader
        navigation={navigation}
        showBack={true}
        onBack={handleBack}
        title={t.students.addStudent}
        subtitle={`${t.common.step} ${step} ${t.common.of} 6`}
      />

      {/* Wizard Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i <= step && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: Personal Details */}
        {step === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step1}</Text>
            <Text style={styles.stepSubtitle}>
              Basic practitioner details with individual English and Tamil fields
            </Text>

            {/* Photo Picker */}
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBox} onPress={handlePhotoAction} activeOpacity={0.7}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                ) : (
                  <User size={38} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
              <View style={styles.photoTextGroup}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.uploadBtn} onPress={takePhotoWithCamera}>
                    <Camera size={15} color="#FFFFFF" />
                    <Text style={styles.uploadBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.galleryBtn} onPress={chooseFromGallery}>
                    <Text style={styles.galleryBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.photoHint}>Open Camera or Pick from Gallery</Text>
              </View>
            </View>

            {/* Student ID & Roll No */}
            <View style={styles.idRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Generated Student ID</Text>
                <TextInput
                  mode="outlined"
                  value={generatedId}
                  editable={false}
                  style={styles.disabledInput}
                  outlineStyle={styles.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Roll Number</Text>
                <TextInput
                  mode="outlined"
                  value={rollNumber}
                  onChangeText={setRollNumber}
                  placeholder="e.g. 101"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
            </View>

            {/* INDIVIDUAL ENGLISH & TAMIL FULL NAME FIELDS */}
            <BilingualInputField
              labelEn="Full Name (English)"
              labelTa="முழுப் பெயர் (தமிழ்)"
              valueEn={nameEn}
              valueTa={nameTa}
              onChangeEn={setNameEn}
              onChangeTa={setNameTa}
              placeholderEn="e.g. M. Anbarasu"
              placeholderTa="எ.கா. எம். அன்பரசு"
              required
            />

            {/* Contact Number */}
            <Text style={styles.fieldLabel}>
              {t.students.contactNumber} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              mode="outlined"
              value={contactNumber}
              onChangeText={setContactNumber}
              placeholder="+91 98404 00000"
              keyboardType="phone-pad"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            {/* Date of Birth & Gender */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.dateOfBirth}</Text>
                <TextInput
                  mode="outlined"
                  value={dob}
                  onChangeText={setDob}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.gender}</Text>
                <View style={styles.genderSelectRow}>
                  {(['MALE', 'FEMALE', 'OTHER'] as Gender[]).map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderBtnText, gender === g && styles.genderBtnTextActive]}>
                        {g === 'MALE' ? 'M' : g === 'FEMALE' ? 'F' : 'O'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* INDIVIDUAL ENGLISH & TAMIL ADDRESS FIELDS */}
            <BilingualInputField
              labelEn="Address (English)"
              labelTa="முகவரி (தமிழ்)"
              valueEn={addressEn}
              valueTa={addressTa}
              onChangeEn={setAddressEn}
              onChangeTa={setAddressTa}
              placeholderEn="e.g. 14 Gandhi Salai, Velachery, Chennai"
              placeholderTa="எ.கா. எண் 14, காந்தி சாலை, வேளச்சேரி, சென்னை"
              multiline
              numberOfLines={2}
            />
          </View>
        )}

        {/* STEP 2: Parent / Guardian */}
        {step === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step2}</Text>
            <Text style={styles.stepSubtitle}>
              Parent or legal guardian contact details
            </Text>

            {/* INDIVIDUAL GUARDIAN NAME FIELDS (ENGLISH & TAMIL) */}
            <BilingualInputField
              labelEn="Parent / Guardian Name (English)"
              labelTa="பெற்றோர் / பாதுகாவலர் பெயர் (தமிழ்)"
              valueEn={guardianNameEn}
              valueTa={guardianNameTa}
              onChangeEn={setGuardianNameEn}
              onChangeTa={setGuardianNameTa}
              placeholderEn="e.g. S. Murugesan"
              placeholderTa="எ.கா. எஸ். முருகேசன்"
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.relationship}</Text>
                <TextInput
                  mode="outlined"
                  value={guardianRelation}
                  onChangeText={setGuardianRelation}
                  placeholder="Father / Mother / Guardian"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.guardianPhone}</Text>
                <TextInput
                  mode="outlined"
                  value={guardianPhone}
                  onChangeText={setGuardianPhone}
                  placeholder="+91 98405 00000"
                  keyboardType="phone-pad"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>{t.students.alternatePhone}</Text>
            <TextInput
              mode="outlined"
              value={guardianAltPhone}
              onChangeText={setGuardianAltPhone}
              placeholder="Optional alternate phone"
              keyboardType="phone-pad"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <Text style={styles.fieldLabel}>{t.students.guardianEmail}</Text>
            <TextInput
              mode="outlined"
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              placeholder="parent@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineStyle={styles.outline}
            />
          </View>
        )}

        {/* STEP 3: Emergency Contact */}
        {step === 3 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step3}</Text>
            <Text style={styles.stepSubtitle}>
              Emergency contact and medical awareness notes
            </Text>

            <Text style={styles.fieldLabel}>{t.students.emergencyName}</Text>
            <TextInput
              mode="outlined"
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="Contact Person Name"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.emergencyPhone}</Text>
                <TextInput
                  mode="outlined"
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="+91 00000 00000"
                  keyboardType="phone-pad"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t.students.emergencyRelation}</Text>
                <TextInput
                  mode="outlined"
                  value={emergencyRelation}
                  onChangeText={setEmergencyRelation}
                  placeholder="e.g. Uncle / Doctor"
                  style={styles.input}
                  outlineStyle={styles.outline}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>{t.students.medicalNotes}</Text>
            <TextInput
              mode="outlined"
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              placeholder="Allergies, chronic conditions, injuries (if any)"
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineStyle={styles.outline}
            />
          </View>
        )}

        {/* STEP 4: Training Details */}
        {step === 4 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step4}</Text>
            <Text style={styles.stepSubtitle}>
              Silambam level, dojo branch & trainer assignment
            </Text>

            {/* Training Level */}
            <Text style={styles.fieldLabel}>{t.students.trainingLevel}</Text>
            <View style={styles.levelChipsGrid}>
              {trainingLevels.map(lvl => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.levelBtn, trainingLevel === lvl && styles.levelBtnActive]}
                  onPress={() => setTrainingLevel(lvl)}
                >
                  <Text style={[styles.levelBtnText, trainingLevel === lvl && styles.levelBtnTextActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Training Center Selection */}
            <Text style={styles.fieldLabel}>{t.students.trainingCenter}</Text>
            <View style={styles.centerChipsGrid}>
              {centers.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.centerBtn, trainingCenterId === c.id && styles.centerBtnActive]}
                  onPress={() => handleCenterChange(c.id)}
                >
                  <Text style={[styles.centerBtnText, trainingCenterId === c.id && styles.centerBtnTextActive]}>
                    {language === 'ta' && c.name_ta ? c.name_ta : c.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Instructor Selection */}
            {instructors.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>{t.students.instructor}</Text>
                <View style={styles.centerChipsGrid}>
                  {instructors.map(inst => (
                    <TouchableOpacity
                      key={inst.id}
                      style={[styles.centerBtn, instructorId === inst.id && styles.centerBtnActive]}
                      onPress={() => setInstructorId(inst.id)}
                    >
                      <Text style={[styles.centerBtnText, instructorId === inst.id && styles.centerBtnTextActive]}>
                        {language === 'ta' && inst.name_ta ? inst.name_ta : inst.name_en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>{t.students.previousExperience}</Text>
            <TextInput
              mode="outlined"
              value={previousExperience}
              onChangeText={setPreviousExperience}
              placeholder="e.g. 2 years Karate, no prior Silambam experience"
              style={styles.input}
              outlineStyle={styles.outline}
            />
          </View>
        )}

        {/* STEP 5: Documents */}
        {step === 5 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step5}</Text>
            <Text style={styles.stepSubtitle}>
              Verify document references (stored as paths in SQLite)
            </Text>

            <View style={styles.docSummaryBox}>
              <FileText size={24} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.docBoxTitle}>Student Photo</Text>
                <Text style={styles.docBoxStatus}>
                  {photoUrl ? 'Attached photo reference ready' : 'No photo chosen (default avatar will be used)'}
                </Text>
              </View>
              <TouchableOpacity style={styles.smallActionBtn} onPress={handlePhotoAction}>
                <Text style={styles.smallActionText}>{photoUrl ? 'Change' : 'Upload Photo'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.docSummaryBox, { marginTop: 12 }]}>
              <Shield size={24} color={theme.colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.docBoxTitle}>Aadhaar / ID Proof</Text>
                <Text style={styles.docBoxStatus}>Verification record created</Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 6: Review & Confirm */}
        {step === 6 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t.students.step6}</Text>
            <Text style={styles.stepSubtitle}>
              Review entered details before finalizing enrollment
            </Text>

            <View style={styles.reviewBox}>
              <Text style={styles.reviewSectionHeader}>Personal Details</Text>
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>ID: </Text>{generatedId}
              </Text>
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Name (EN): </Text>{nameEn}
              </Text>
              {nameTa ? (
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Name (TA): </Text>{nameTa}
                </Text>
              ) : null}
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Contact: </Text>{contactNumber}
              </Text>
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Gender / DOB: </Text>{gender} • {dob}
              </Text>
              {addressEn ? (
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Address (EN): </Text>{addressEn}
                </Text>
              ) : null}
              {addressTa ? (
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Address (TA): </Text>{addressTa}
                </Text>
              ) : null}
            </View>

            {guardianNameEn ? (
              <View style={[styles.reviewBox, { marginTop: 12 }]}>
                <Text style={styles.reviewSectionHeader}>Guardian Details</Text>
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Name: </Text>{guardianNameEn} {guardianNameTa ? `(${guardianNameTa})` : ''}
                </Text>
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Relation: </Text>{guardianRelation}
                </Text>
                <Text style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Phone: </Text>{guardianPhone}
                </Text>
              </View>
            ) : null}

            <View style={[styles.reviewBox, { marginTop: 12 }]}>
              <Text style={styles.reviewSectionHeader}>Training Information</Text>
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Level: </Text>{trainingLevel}
              </Text>
              <Text style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Center: </Text>
                {centers.find(c => c.id === trainingCenterId)?.name_en || 'Selected Center'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <ArrowLeft size={18} color={theme.colors.primary} />
          <Text style={styles.backBtnText}>
            {step === 1 ? t.common.cancel : t.common.back}
          </Text>
        </TouchableOpacity>

        {step < 6 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>{t.common.next}</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveStudent}
            disabled={saving}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Confirm & Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  progressSegmentActive: {
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  stepCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    marginTop: 4,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  photoBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoTextGroup: {
    flex: 1,
    gap: 6,
  },
  uploadBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  galleryBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  galleryBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  photoHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  idRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 6,
  },
  required: {
    color: theme.colors.crimson,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 48,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  disabledInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    height: 48,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  outline: {
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 6,
    height: 48,
  },
  genderBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  genderBtnTextActive: {
    color: '#FFFFFF',
  },
  levelChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  levelBtn: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  levelBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  levelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  levelBtnTextActive: {
    color: '#FFFFFF',
  },
  centerChipsGrid: {
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  centerBtn: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  centerBtnActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  centerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  centerBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  docSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: 12,
  },
  docBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  docBoxStatus: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  smallActionBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smallActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  reviewBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewSectionHeader: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  reviewItem: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  reviewLabel: {
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  footerActions: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  nextBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  saveBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
