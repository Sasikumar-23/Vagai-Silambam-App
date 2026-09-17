import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform, KeyboardAvoidingView, TouchableOpacity, Image, Alert } from 'react-native';
import { TextInput, Button, Text, Surface, useTheme } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { storage, Student } from '../utils/storage';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { User, Calendar, Camera, ArrowLeft, UserCircle2, UserPlus } from 'lucide-react-native';

export default function AddStudentScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('Male');
  const [contact, setContact] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    if (!name || !contact) return;
    setLoading(true);
    const newStudent: Student = {
      id: Date.now().toString(),
      name,
      dob: format(dob, 'yyyy-MM-dd'),
      gender,
      contact,
      guardianName,
      guardianPhone,
      photo: photo || undefined,
    };
    await storage.saveStudent(newStudent);
    setLoading(false);
    Alert.alert('Success', 'Student registered successfully');
    navigation.goBack();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDob(selectedDate);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#1A3673" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Registration</Text>
        <TouchableOpacity style={styles.profileButton}>
          <UserCircle2 color="#1A3673" size={28} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>New Student</Text>
        <Text style={styles.subtitle}>Fill in the details below to enroll a new student in the Vagai Silambam registry.</Text>

        <Surface style={styles.photoCard} elevation={1}>
          <TouchableOpacity style={styles.photoPlaceholder} onPress={pickImage}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoImage} />
            ) : (
              <User color="#999" size={40} />
            )}
          </TouchableOpacity>
          <View style={styles.photoInfo}>
            <Text style={styles.photoLabel}>Upload Photo</Text>
            <Text style={styles.photoHint}>Recommended: 400x400px</Text>
          </View>
          <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
            <Camera color="#1A3673" size={24} />
          </TouchableOpacity>
        </Surface>

        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            placeholder="e.g. John Doe"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <Text style={styles.inputLabel}>Date of Birth</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            style={styles.dateSelector}
          >
            <Text style={styles.dateText}>{format(dob, 'MM/dd/yyyy')}</Text>
            <Calendar color="#333" size={20} />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dob}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female'].map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.genderItem,
                  gender === item && styles.genderItemActive
                ]}
                onPress={() => setGender(item)}
              >
                <Text style={[
                  styles.genderText,
                  gender === item && styles.genderTextActive
                ]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Contact Number</Text>
          <View style={styles.contactRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              placeholder="00000 00000"
              value={contact}
              onChangeText={setContact}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              outlineStyle={styles.outline}
            />
          </View>

          <Surface style={styles.emergencyCard} elevation={1}>
            <Text style={styles.emergencyTitle}>EMERGENCY CONTACT</Text>
            
            <Text style={styles.emergencyInputLabel}>Parent Name</Text>
            <TextInput
              placeholder="e.g. Robert Smith"
              value={guardianName}
              onChangeText={setGuardianName}
              mode="outlined"
              style={styles.emergencyInput}
              outlineStyle={styles.outline}
            />

            <Text style={styles.emergencyInputLabel}>Parent Phone Number</Text>
            <TextInput
              placeholder="e.g. 00000 00000"
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="numeric"
              mode="outlined"
              style={styles.emergencyInput}
              outlineStyle={styles.outline}
            />
          </Surface>

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
            contentStyle={styles.registerButtonContent}
            labelStyle={styles.registerButtonLabel}
          >
            <View style={styles.registerButtonInner}>
              <Text style={styles.registerButtonText}>Register Student</Text>
              <UserPlus color="#fff" size={20} />
            </View>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#F5F7FB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A3673',
  },
  profileButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A3673',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 32,
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F7FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  photoInfo: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3673',
    marginBottom: 4,
  },
  photoHint: {
    fontSize: 13,
    color: '#999',
  },
  cameraButton: {
    padding: 8,
  },
  formSection: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A3673',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    height: 54,
    marginBottom: 16,
  },
  outline: {
    borderRadius: 8,
    borderColor: '#E5E9F0',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 15,
    color: '#333',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  genderItem: {
    flex: 1,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderItemActive: {
    backgroundColor: '#fff',
    borderColor: '#1A3673',
  },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  genderTextActive: {
    color: '#1A3673',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countryCode: {
    width: 80,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    backgroundColor: '#EBF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3673',
  },
  emergencyCard: {
    backgroundColor: '#EBF2FF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C5D8F1',
    borderStyle: 'dashed',
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A3673',
    letterSpacing: 1,
    marginBottom: 16,
  },
  emergencyInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
  },
  emergencyInput: {
    backgroundColor: '#fff',
    height: 50,
    marginBottom: 16,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  registerButton: {
    backgroundColor: '#1A3673',
    borderRadius: 12,
    marginTop: 8,
  },
  registerButtonContent: {
    height: 60,
  },
  registerButtonLabel: {
    color: '#fff',
  },
  registerButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});









