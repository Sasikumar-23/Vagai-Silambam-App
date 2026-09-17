import * as SQLite from 'expo-sqlite';

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Indexes for Students
    CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
    CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_students_name_en ON students(name_en);
    CREATE INDEX IF NOT EXISTS idx_students_name_ta ON students(name_ta);
    CREATE INDEX IF NOT EXISTS idx_students_contact ON students(contact_number);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(student_status);
    CREATE INDEX IF NOT EXISTS idx_students_center ON students(training_center_id);
    CREATE INDEX IF NOT EXISTS idx_students_instructor ON students(instructor_id);

    -- Indexes for Attendance
    CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_center ON attendance_sessions(training_center_id);

    -- Indexes for Events
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type_id);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

    -- Indexes for Event Registrations
    CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_student ON event_registrations(student_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON event_registrations(registration_status);

    -- Indexes for Fees & Payments
    CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
    CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(fee_type_id);
    CREATE INDEX IF NOT EXISTS idx_fees_due_date ON fees(due_date);
    CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
    CREATE INDEX IF NOT EXISTS idx_payments_fee ON payments(fee_id);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

    -- Indexes for Uniforms
    CREATE INDEX IF NOT EXISTS idx_uniforms_student ON uniforms(student_id);
    CREATE INDEX IF NOT EXISTS idx_uniforms_type ON uniforms(uniform_type_id);

    -- Indexes for Achievements & Certificates
    CREATE INDEX IF NOT EXISTS idx_achievements_student ON achievements(student_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);

    -- Indexes for Notifications
    CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id, is_read);

    -- View 1: student_attendance_summary
    -- Attendance percentage formula: (Present + Late) / Applicable (Total - Leave) * 100
    CREATE VIEW IF NOT EXISTS student_attendance_summary AS
    SELECT 
      s.id AS student_id,
      s.student_id AS student_code,
      s.name_en AS student_name_en,
      s.name_ta AS student_name_ta,
      COUNT(a.id) AS total_sessions,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_count,
      ROUND(
        CASE 
          WHEN (COUNT(a.id) - SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END)) > 0 
          THEN (
            (CAST(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS REAL) + 
             CAST(SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) AS REAL)) / 
            (COUNT(a.id) - SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END))
          ) * 100.0
          ELSE 0.0
        END, 1
      ) AS attendance_percentage
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id
    GROUP BY s.id;

    -- View 2: student_fee_summary
    CREATE VIEW IF NOT EXISTS student_fee_summary AS
    SELECT 
      s.id AS student_id,
      s.student_id AS student_code,
      s.name_en AS student_name_en,
      s.name_ta AS student_name_ta,
      COALESCE(SUM(f.amount), 0.0) AS total_fees,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = s.id), 0.0) AS total_paid,
      ROUND(COALESCE(SUM(f.amount), 0.0) - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = s.id), 0.0), 2) AS total_pending
    FROM students s
    LEFT JOIN fees f ON s.id = f.student_id AND f.status != 'WAIVED'
    GROUP BY s.id;

    -- View 3: event_participant_summary
    CREATE VIEW IF NOT EXISTS event_participant_summary AS
    SELECT 
      e.id AS event_id,
      e.event_code,
      e.name_en AS event_name_en,
      e.name_ta AS event_name_ta,
      e.maximum_participants,
      COUNT(r.id) AS participant_count
    FROM events e
    LEFT JOIN event_registrations r ON e.id = r.event_id AND r.registration_status != 'CANCELLED'
    GROUP BY e.id;

    -- View 4: daily_attendance_summary
    CREATE VIEW IF NOT EXISTS daily_attendance_summary AS
    SELECT 
      ses.session_date,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_count
    FROM attendance_sessions ses
    JOIN attendance a ON ses.id = a.session_id
    GROUP BY ses.session_date;
  `);
}
