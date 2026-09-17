export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'STAFF';

export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export type TrainingLevel = 'BEGINNER' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'MASTER';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

export type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

export type RegistrationStatus = 'REGISTERED' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';

export type ParticipationStatus = 'NOT_MARKED' | 'PARTICIPATED' | 'DID_NOT_PARTICIPATE';

export type EventResultType = 'Winner' | 'Runner-up' | 'Third Place' | 'Participation' | 'Special Award' | 'Other';

export type FeeStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'ONLINE' | 'OTHER';

export type UniformCondition = 'NEW' | 'GOOD' | 'DAMAGED' | 'LOST' | 'RETURNED';

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'MULTI_SELECT' | 'CHECKBOX' | 'RADIO' | 'TEXTAREA';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name_en: string;
  full_name_ta: string;
  email?: string;
  phone?: string;
  role: UserRole;
  is_active: number; // 1 or 0
  created_at: string;
  updated_at: string;
}

export interface TrainingCenter {
  id: string;
  code: string;
  name_en: string;
  name_ta: string;
  address_en?: string;
  address_ta?: string;
  city: string;
  contact_person?: string;
  contact_phone?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Instructor {
  id: string;
  user_id?: string;
  name_en: string;
  name_ta: string;
  phone: string;
  email?: string;
  qualification_en?: string;
  qualification_ta?: string;
  training_center_id: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id: string; // e.g. VS-2026-0001
  roll_number?: string;
  name_en: string;
  name_ta: string;
  photo_url?: string;
  date_of_birth: string;
  gender: Gender;
  contact_number: string;
  address_en?: string;
  address_ta?: string;
  joining_date: string;
  student_status: StudentStatus;
  medical_notes?: string;
  previous_silambam_experience?: string;
  training_level: TrainingLevel;
  training_center_id: string;
  instructor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ParentGuardian {
  id: string;
  name_en: string;
  name_ta?: string;
  relationship: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  address_en?: string;
  address_ta?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentGuardian {
  id: string;
  student_id: string;
  guardian_id: string;
  is_primary: number;
  is_emergency_contact: number;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  training_center_id: string;
  instructor_id?: string;
  session_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  session_name: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
  marked_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  name_en: string;
  name_ta: string;
  description_en?: string;
  description_ta?: string;
  created_at: string;
  updated_at: string;
}

export interface EventItem {
  id: string;
  event_code: string;
  name_en: string;
  name_ta: string;
  event_type_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location_en: string;
  location_ta: string;
  organizer_en: string;
  organizer_ta: string;
  description_en?: string;
  description_ta?: string;
  registration_required: number;
  registration_deadline?: string;
  event_fee: number;
  maximum_participants: number;
  status: EventStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventCustomField {
  id: string;
  event_id: string;
  field_name_en: string;
  field_name_ta: string;
  field_type: CustomFieldType;
  is_required: number;
  sort_order: number;
  created_at: string;
}

export interface EventCustomFieldOption {
  id: string;
  field_id: string;
  option_label_en: string;
  option_label_ta: string;
  option_value: string;
  sort_order: number;
}

export interface EventCustomFieldValue {
  id: string;
  registration_id: string;
  field_id: string;
  value_text: string;
}

export interface EventRegistration {
  id: string;
  registration_code: string; // e.g. VSE-2026-00001
  event_id: string;
  student_id: string;
  registration_date: string;
  category?: string;
  age_category?: string;
  gender_category?: string;
  skill_category?: string;
  registration_status: RegistrationStatus;
  participation_status: ParticipationStatus;
  remarks?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventResult {
  id: string;
  event_id: string;
  student_id: string;
  category?: string;
  participation: ParticipationStatus;
  result: EventResultType;
  position?: string;
  certificate?: string;
  medal?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface FeeType {
  id: string;
  name_en: string;
  name_ta: string;
  default_amount: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Fee {
  id: string;
  fee_number: string;
  student_id: string;
  fee_type_id: string;
  description?: string;
  amount: number;
  due_date: string;
  status: FeeStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payment_number: string; // e.g. VSP-2026-00001
  fee_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  remarks?: string;
  received_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UniformType {
  id: string;
  name_en: string;
  name_ta: string;
  description_en?: string;
  description_ta?: string;
  default_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Uniform {
  id: string;
  uniform_number: string;
  student_id: string;
  uniform_type_id: string;
  size: string;
  quantity: number;
  issue_date: string;
  return_date?: string;
  amount: number;
  payment_status: FeeStatus;
  condition: UniformCondition;
  remarks?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  student_id: string;
  event_id?: string;
  achievement_type: string;
  title_en: string;
  title_ta: string;
  position?: string;
  achievement_date: string;
  description_en?: string;
  description_ta?: string;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  certificate_number: string;
  student_id: string;
  event_id?: string;
  achievement_id?: string;
  certificate_title_en: string;
  certificate_title_ta: string;
  issue_date: string;
  file_url?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  document_type: string;
  file_uri: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_type: string;
  title_en: string;
  title_ta: string;
  message_en: string;
  message_ta: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface NotificationRecipient {
  id: string;
  notification_id: string;
  user_id: string;
  is_read: number;
  read_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: string;
  new_values?: string;
  created_at: string;
}

export interface SettingItem {
  key: string;
  value: string;
}

// Summary Views
export interface StudentAttendanceSummaryView {
  student_id: string;
  student_name_en: string;
  student_name_ta: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  attendance_percentage: number;
}

export interface StudentFeeSummaryView {
  student_id: string;
  student_name_en: string;
  student_name_ta: string;
  total_fees: number;
  total_paid: number;
  total_pending: number;
}

export interface EventParticipantSummaryView {
  event_id: string;
  event_name_en: string;
  event_name_ta: string;
  participant_count: number;
}

export interface DailyAttendanceSummaryView {
  session_date: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
}
