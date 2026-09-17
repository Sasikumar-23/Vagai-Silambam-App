import * as SQLite from 'expo-sqlite';

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- 1. Roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      role_name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name_en TEXT NOT NULL,
      full_name_ta TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'STUDENT',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. User Roles
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(user_id, role_id)
    );

    -- 4. Training Centers
    CREATE TABLE IF NOT EXISTS training_centers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      address_en TEXT,
      address_ta TEXT,
      city TEXT NOT NULL DEFAULT 'Chennai',
      contact_person TEXT,
      contact_phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. Instructors
    CREATE TABLE IF NOT EXISTS instructors (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      qualification_en TEXT,
      qualification_ta TEXT,
      training_center_id TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (training_center_id) REFERENCES training_centers(id) ON DELETE RESTRICT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 6. Students
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      roll_number TEXT,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      photo_url TEXT,
      date_of_birth TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('MALE', 'FEMALE', 'OTHER')),
      contact_number TEXT NOT NULL,
      address_en TEXT,
      address_ta TEXT,
      joining_date TEXT NOT NULL DEFAULT (date('now')),
      student_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(student_status IN ('ACTIVE', 'INACTIVE')),
      medical_notes TEXT,
      previous_silambam_experience TEXT,
      training_level TEXT NOT NULL DEFAULT 'BEGINNER' CHECK(training_level IN ('BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'MASTER')),
      training_center_id TEXT NOT NULL,
      instructor_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (training_center_id) REFERENCES training_centers(id) ON DELETE RESTRICT,
      FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL
    );

    -- 7. Parents / Guardians
    CREATE TABLE IF NOT EXISTS parents_guardians (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ta TEXT,
      relationship TEXT NOT NULL DEFAULT 'Father',
      phone TEXT NOT NULL,
      alternate_phone TEXT,
      email TEXT,
      address_en TEXT,
      address_ta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 8. Student Guardians (Many-to-Many)
    CREATE TABLE IF NOT EXISTS student_guardians (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      guardian_id TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 1,
      is_emergency_contact INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES parents_guardians(id) ON DELETE CASCADE,
      UNIQUE(student_id, guardian_id)
    );

    -- 9. Attendance Sessions
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      training_center_id TEXT NOT NULL,
      instructor_id TEXT,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT '06:00',
      end_time TEXT NOT NULL DEFAULT '08:00',
      session_name TEXT NOT NULL DEFAULT 'Morning Training',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (training_center_id) REFERENCES training_centers(id) ON DELETE RESTRICT,
      FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL
    );

    -- 10. Attendance
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
      remarks TEXT,
      marked_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    -- 11. Event Types
    CREATE TABLE IF NOT EXISTS event_types (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      description_en TEXT,
      description_ta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 12. Events
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      event_type_id TEXT NOT NULL,
      event_date TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '17:00',
      location_en TEXT NOT NULL,
      location_ta TEXT NOT NULL,
      organizer_en TEXT NOT NULL,
      organizer_ta TEXT NOT NULL,
      description_en TEXT,
      description_ta TEXT,
      registration_required INTEGER NOT NULL DEFAULT 1,
      registration_deadline TEXT,
      event_fee REAL NOT NULL DEFAULT 0.0,
      maximum_participants INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('DRAFT', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE RESTRICT
    );

    -- 13. Event Custom Fields (Field Builder)
    CREATE TABLE IF NOT EXISTS event_custom_fields (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      field_name_en TEXT NOT NULL,
      field_name_ta TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK(field_type IN ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'TEXTAREA')),
      is_required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    -- 14. Event Custom Field Options
    CREATE TABLE IF NOT EXISTS event_custom_field_options (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL,
      option_label_en TEXT NOT NULL,
      option_label_ta TEXT NOT NULL,
      option_value TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (field_id) REFERENCES event_custom_fields(id) ON DELETE CASCADE
    );

    -- 15. Event Custom Field Values
    CREATE TABLE IF NOT EXISTS event_custom_field_values (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      value_text TEXT,
      FOREIGN KEY (registration_id) REFERENCES event_registrations(id) ON DELETE CASCADE,
      FOREIGN KEY (field_id) REFERENCES event_custom_fields(id) ON DELETE CASCADE
    );

    -- 16. Event Registrations
    CREATE TABLE IF NOT EXISTS event_registrations (
      id TEXT PRIMARY KEY,
      registration_code TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      registration_date TEXT NOT NULL DEFAULT (date('now')),
      category TEXT,
      age_category TEXT,
      gender_category TEXT,
      skill_category TEXT,
      registration_status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(registration_status IN ('REGISTERED', 'CONFIRMED', 'CANCELLED', 'WAITLISTED')),
      participation_status TEXT NOT NULL DEFAULT 'NOT_MARKED' CHECK(participation_status IN ('NOT_MARKED', 'PARTICIPATED', 'DID_NOT_PARTICIPATE')),
      remarks TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(event_id, student_id)
    );

    -- 17. Event Results
    CREATE TABLE IF NOT EXISTS event_results (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      category TEXT,
      participation TEXT NOT NULL DEFAULT 'PARTICIPATED',
      result TEXT NOT NULL CHECK(result IN ('Winner', 'Runner-up', 'Third Place', 'Participation', 'Special Award', 'Other')),
      position TEXT,
      certificate TEXT,
      medal TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- 18. Fee Types
    CREATE TABLE IF NOT EXISTS fee_types (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      default_amount REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 19. Fees
    CREATE TABLE IF NOT EXISTS fees (
      id TEXT PRIMARY KEY,
      fee_number TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL,
      fee_type_id TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL CHECK(amount >= 0),
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE RESTRICT
    );

    -- 20. Payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      fee_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      payment_date TEXT NOT NULL DEFAULT (date('now')),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER')),
      transaction_reference TEXT,
      remarks TEXT,
      received_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (fee_id) REFERENCES fees(id) ON DELETE RESTRICT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
    );

    -- 21. Uniform Types
    CREATE TABLE IF NOT EXISTS uniform_types (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ta TEXT NOT NULL,
      description_en TEXT,
      description_ta TEXT,
      default_price REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 22. Uniforms Issued
    CREATE TABLE IF NOT EXISTS uniforms (
      id TEXT PRIMARY KEY,
      uniform_number TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL,
      uniform_type_id TEXT NOT NULL,
      size TEXT NOT NULL DEFAULT 'M',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      issue_date TEXT NOT NULL DEFAULT (date('now')),
      return_date TEXT,
      amount REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
      condition TEXT NOT NULL DEFAULT 'NEW' CHECK(condition IN ('NEW', 'GOOD', 'DAMAGED', 'LOST', 'RETURNED')),
      remarks TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (uniform_type_id) REFERENCES uniform_types(id) ON DELETE RESTRICT
    );

    -- 23. Achievements
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      event_id TEXT,
      achievement_type TEXT NOT NULL DEFAULT 'Competition',
      title_en TEXT NOT NULL,
      title_ta TEXT NOT NULL,
      position TEXT,
      achievement_date TEXT NOT NULL DEFAULT (date('now')),
      description_en TEXT,
      description_ta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
    );

    -- 24. Certificates
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      certificate_number TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL,
      event_id TEXT,
      achievement_id TEXT,
      certificate_title_en TEXT NOT NULL,
      certificate_title_ta TEXT NOT NULL,
      issue_date TEXT NOT NULL DEFAULT (date('now')),
      file_url TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE SET NULL
    );

    -- 25. Documents
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('ID Proof', 'Photo', 'Medical', 'Certificate', 'Application', 'Other')),
      file_uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- 26. Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      notification_type TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_ta TEXT NOT NULL,
      message_en TEXT NOT NULL,
      message_ta TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 27. Notification Recipients
    CREATE TABLE IF NOT EXISTS notification_recipients (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 28. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 29. Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
