import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../connection';

export async function seedDatabase(force: boolean = false): Promise<void> {
  const db = await getDatabase();

  const userCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCountRow && userCountRow.count > 0 && !force) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  console.log('Seeding database with development data...');

  await db.withTransactionAsync(async () => {
    // 1. Clear if force
    if (force) {
      await db.execAsync(`
        DELETE FROM notification_recipients;
        DELETE FROM notifications;
        DELETE FROM audit_logs;
        DELETE FROM documents;
        DELETE FROM certificates;
        DELETE FROM achievements;
        DELETE FROM uniforms;
        DELETE FROM uniform_types;
        DELETE FROM payments;
        DELETE FROM fees;
        DELETE FROM fee_types;
        DELETE FROM event_results;
        DELETE FROM event_custom_field_values;
        DELETE FROM event_custom_field_options;
        DELETE FROM event_custom_fields;
        DELETE FROM event_registrations;
        DELETE FROM events;
        DELETE FROM event_types;
        DELETE FROM attendance;
        DELETE FROM attendance_sessions;
        DELETE FROM student_guardians;
        DELETE FROM parents_guardians;
        DELETE FROM students;
        DELETE FROM instructors;
        DELETE FROM training_centers;
        DELETE FROM user_roles;
        DELETE FROM roles;
        DELETE FROM users;
        DELETE FROM settings;
      `);
    }

    // 2. Roles
    await db.runAsync("INSERT OR REPLACE INTO roles (id, role_name, description) VALUES ('role_admin', 'ADMIN', 'Full Administrative Access')");
    await db.runAsync("INSERT OR REPLACE INTO roles (id, role_name, description) VALUES ('role_instructor', 'INSTRUCTOR', 'Silambam Master / Trainer')");
    await db.runAsync("INSERT OR REPLACE INTO roles (id, role_name, description) VALUES ('role_staff', 'STAFF', 'Office Staff & Accounts')");

    // 3. Users
    // admin / admin123, instructor / inst123, staff / staff123
    await db.runAsync(`
      INSERT OR REPLACE INTO users (id, username, password_hash, full_name_en, full_name_ta, role, email, phone)
      VALUES 
      ('usr_admin', 'admin', 'admin123', 'Asan K. Senthilvel', 'ஆசான் கே. செந்தில்வேல்', 'ADMIN', 'admin@vagaisilambam.in', '+91 98401 23456'),
      ('usr_instructor', 'instructor', 'inst123', 'Master V. Manikandan', 'மாஸ்டர் வி. மணிகண்டன்', 'INSTRUCTOR', 'mani@vagaisilambam.in', '+91 98402 34567'),
      ('usr_staff', 'staff', 'staff123', 'R. Meenakshi', 'ஆர். மீனாட்சி', 'STAFF', 'meenakshi@vagaisilambam.in', '+91 98403 45678')
    `);

    // 4. Training Centers (Single Academy Dojo)
    await db.runAsync(`
      INSERT OR REPLACE INTO training_centers (id, code, name_en, name_ta, address_en, address_ta, city, contact_person, contact_phone)
      VALUES 
      ('tc_01', 'VS-CHE', 'Chennai Head Dojo (Velachery)', 'சென்னை தலைமை சிலம்பக்கூடம் (வேளச்சேரி)', 'No 14, Gandhi Salai, Velachery, Chennai', 'எண் 14, காந்தி சாலை, வேளச்சேரி, சென்னை', 'Chennai', 'K. Senthilvel', '+91 98401 23456')
    `);

    // 5. Instructors
    await db.runAsync(`
      INSERT OR REPLACE INTO instructors (id, user_id, name_en, name_ta, phone, email, qualification_en, qualification_ta, training_center_id)
      VALUES 
      ('inst_01', 'usr_admin', 'Asan K. Senthilvel', 'ஆசான் கே. செந்தில்வேல்', '+91 98401 23456', 'admin@vagaisilambam.in', 'Grand Master (30+ Yrs Exp)', 'முதன்மை ஆசான் (30+ ஆண்டுகள் அனுபவம்)', 'tc_01'),
      ('inst_02', 'usr_instructor', 'Master V. Manikandan', 'மாஸ்டர் வி. மணிகண்டன்', '+91 98402 34567', 'mani@vagaisilambam.in', 'State Champion & Senior Trainer', 'மாநில சிலம்ப சாம்பியன் & மூத்த பயிற்சியாளர்', 'tc_01')
    `);

    // 6. 10 Realistic Fake Students
    const studentsData = [
      {
        id: 'stu_01',
        student_id: 'VS-2026-0001',
        roll_number: '01',
        name_en: 'Anbarasu Murugesan',
        name_ta: 'அன்பரசு முருகேசன்',
        dob: '2010-05-14',
        gender: 'MALE',
        contact: '+91 98404 56789',
        address_en: '12 Temple Street, Velachery, Chennai',
        address_ta: '12 கோவில் தெரு, வேளச்சேரி, சென்னை',
        level: 'INTERMEDIATE',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'ACTIVE',
      },
      {
        id: 'stu_02',
        student_id: 'VS-2026-0002',
        roll_number: '02',
        name_en: 'Kavitha Ramachandran',
        name_ta: 'கவிதா ராமச்சந்திரன்',
        dob: '2011-08-22',
        gender: 'FEMALE',
        contact: '+91 98404 11111',
        address_en: '45 Cross Road, Anna Nagar, Madurai',
        address_ta: '45 குறுக்கு சாலை, அண்ணா நகர், மதுரை',
        level: 'ADVANCED',
        center_id: 'tc_01',
        inst_id: 'inst_02',
        status: 'ACTIVE',
      },
      {
        id: 'stu_03',
        student_id: 'VS-2026-0003',
        roll_number: '03',
        name_en: 'Saravanan Pitchai',
        name_ta: 'சரவணன் பிச்சை',
        dob: '2009-12-03',
        gender: 'MALE',
        contact: '+91 98404 22222',
        address_en: '8 Trunk Road, Tambaram, Chennai',
        address_ta: '8 மெயின் ரோடு, தாம்பரம், சென்னை',
        level: 'MASTER',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'ACTIVE',
      },
      {
        id: 'stu_04',
        student_id: 'VS-2026-0004',
        roll_number: '04',
        name_en: 'Deepa Muthukumar',
        name_ta: 'தீபா முத்துக்குமார்',
        dob: '2012-03-19',
        gender: 'FEMALE',
        contact: '+91 98404 33333',
        address_en: '23 South Mada St, Mylapore, Chennai',
        address_ta: '23 தெற்கு மாட வீதி, மயிலாப்பூர், சென்னை',
        level: 'BASIC',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'ACTIVE',
      },
      {
        id: 'stu_05',
        student_id: 'VS-2026-0005',
        roll_number: '05',
        name_en: 'Karthik Sivakumar',
        name_ta: 'கார்த்திக் சிவகுமார்',
        dob: '2013-07-11',
        gender: 'MALE',
        contact: '+91 98404 44444',
        address_en: '67 KK Nagar, Madurai',
        address_ta: '67 கே.கே. நகர், மதுரை',
        level: 'BEGINNER',
        center_id: 'tc_01',
        inst_id: 'inst_02',
        status: 'ACTIVE',
      },
      {
        id: 'stu_06',
        student_id: 'VS-2026-0006',
        roll_number: '06',
        name_en: 'Pooja Venkatesh',
        name_ta: 'பூஜா வெங்கடேஷ்',
        dob: '2010-10-30',
        gender: 'FEMALE',
        contact: '+91 98404 55555',
        address_en: '34 Kamarajar St, Velachery, Chennai',
        address_ta: '34 காமராஜர் தெரு, வேளச்சேரி, சென்னை',
        level: 'INTERMEDIATE',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'ACTIVE',
      },
      {
        id: 'stu_07',
        student_id: 'VS-2026-0007',
        roll_number: '07',
        name_en: 'Vignesh Balaji',
        name_ta: 'விக்னேஷ் பாலாஜி',
        dob: '2008-01-15',
        gender: 'MALE',
        contact: '+91 98404 66666',
        address_en: '19 Park View, Guindy, Chennai',
        address_ta: '19 பார்க் வியூ, கிண்டி, சென்னை',
        level: 'ADVANCED',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'ACTIVE',
      },
      {
        id: 'stu_08',
        student_id: 'VS-2026-0008',
        roll_number: '08',
        name_en: 'Nithya Sundaram',
        name_ta: 'நித்யா சுந்தரம்',
        dob: '2014-04-05',
        gender: 'FEMALE',
        contact: '+91 98404 77777',
        address_en: '5 Alagarkoil Rd, Madurai',
        address_ta: '5 அழகர்கோவில் ரோடு, மதுரை',
        level: 'BEGINNER',
        center_id: 'tc_01',
        inst_id: 'inst_02',
        status: 'ACTIVE',
      },
      {
        id: 'stu_09',
        student_id: 'VS-2026-0009',
        roll_number: '09',
        name_en: 'Manoj Kumaravel',
        name_ta: 'மனோஜ் குமரவேல்',
        dob: '2011-09-18',
        gender: 'MALE',
        contact: '+91 98404 88888',
        address_en: '72 North Car St, Madurai',
        address_ta: '72 வடக்கு ரத வீதி, மதுரை',
        level: 'BASIC',
        center_id: 'tc_01',
        inst_id: 'inst_02',
        status: 'ACTIVE',
      },
      {
        id: 'stu_10',
        student_id: 'VS-2026-0010',
        roll_number: '10',
        name_en: 'Revathi Chandran',
        name_ta: 'ரேவதி சந்திரன்',
        dob: '2009-06-25',
        gender: 'FEMALE',
        contact: '+91 98404 99999',
        address_en: '10 Beach Road, Chennai',
        address_ta: '10 கடற்கரை சாலை, சென்னை',
        level: 'INTERMEDIATE',
        center_id: 'tc_01',
        inst_id: 'inst_01',
        status: 'INACTIVE',
      },
    ];

    for (const s of studentsData) {
      await db.runAsync(`
        INSERT OR REPLACE INTO students (
          id, student_id, roll_number, name_en, name_ta, date_of_birth, gender, contact_number,
          address_en, address_ta, joining_date, student_status, training_level, training_center_id, instructor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-10', ?, ?, ?, ?)
      `, s.id, s.student_id, s.roll_number, s.name_en, s.name_ta, s.dob, s.gender, s.contact, s.address_en, s.address_ta, s.status, s.level, s.center_id, s.inst_id);
    }

    // 7. Guardians
    await db.runAsync(`
      INSERT OR REPLACE INTO parents_guardians (id, name_en, name_ta, relationship, phone, email, address_en, address_ta)
      VALUES
      ('pg_01', 'S. Murugesan', 'எஸ். முருகேசன்', 'Father', '+91 98405 67890', 'murugesan@email.com', '12 Temple Street, Velachery, Chennai', '12 கோவில் தெரு, வேளச்சேரி, சென்னை'),
      ('pg_02', 'R. Ramachandran', 'ஆர். ராமச்சந்திரன்', 'Father', '+91 98405 11111', 'ramachandran@email.com', '45 Cross Road, Anna Nagar, Madurai', '45 குறுக்கு சாலை, அண்ணா நகர், மதுரை'),
      ('pg_03', 'M. Muthukumar', 'எம். முத்துக்குமார்', 'Father', '+91 98405 22222', 'muthu@email.com', '23 South Mada St, Mylapore, Chennai', '23 தெற்கு மாட வீதி, மயிலாப்பூர், சென்னை')
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO student_guardians (id, student_id, guardian_id, is_primary, is_emergency_contact)
      VALUES
      ('sg_01', 'stu_01', 'pg_01', 1, 1),
      ('sg_02', 'stu_02', 'pg_02', 1, 1),
      ('sg_03', 'stu_04', 'pg_03', 1, 1)
    `);

    // 8. Attendance Sessions & Attendance Records
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await db.runAsync(`
      INSERT OR REPLACE INTO attendance_sessions (id, training_center_id, instructor_id, session_date, start_time, end_time, session_name)
      VALUES
      ('ses_today_01', 'tc_01', 'inst_01', '${today}', '06:00', '08:00', 'Morning Batch - Stick Basics'),
      ('ses_yest_01', 'tc_01', 'inst_01', '${yesterday}', '06:00', '08:00', 'Morning Batch - Footwork & Alankara Silambam')
    `);

    // Today's attendance
    const todayAttendance = [
      { id: 'att_01', student_id: 'stu_01', status: 'PRESENT' },
      { id: 'att_02', student_id: 'stu_03', status: 'PRESENT' },
      { id: 'att_03', student_id: 'stu_04', status: 'LATE' },
      { id: 'att_04', student_id: 'stu_06', status: 'PRESENT' },
      { id: 'att_05', student_id: 'stu_07', status: 'ABSENT' },
    ];

    for (const a of todayAttendance) {
      await db.runAsync(`
        INSERT OR REPLACE INTO attendance (id, session_id, student_id, status, marked_by)
        VALUES (?, 'ses_today_01', ?, ?, 'inst_01')
      `, a.id, a.student_id, a.status);
    }

    // Yesterday's attendance
    const yestAttendance = [
      { id: 'att_y1', student_id: 'stu_01', status: 'PRESENT' },
      { id: 'att_y2', student_id: 'stu_03', status: 'PRESENT' },
      { id: 'att_y3', student_id: 'stu_04', status: 'PRESENT' },
      { id: 'att_y4', student_id: 'stu_06', status: 'LEAVE' },
      { id: 'att_y5', student_id: 'stu_07', status: 'PRESENT' },
    ];

    for (const a of yestAttendance) {
      await db.runAsync(`
        INSERT OR REPLACE INTO attendance (id, session_id, student_id, status, marked_by)
        VALUES (?, 'ses_yest_01', ?, ?, 'inst_01')
      `, a.id, a.student_id, a.status);
    }

    // 9. Event Types
    await db.runAsync(`
      INSERT OR REPLACE INTO event_types (id, name_en, name_ta, description_en, description_ta)
      VALUES
      ('et_01', 'Competition', 'சிலம்பப் போட்டி', 'Inter-dojo, District and State level Silambam championship', 'மாவட்ட மற்றும் மாநில அளவிலான சிலம்பப் போட்டி'),
      ('et_02', 'Training Camp', 'பயிற்சி முகாம்', 'Intensive residential weapons and self-defense camp', 'பாரம்பரிய ஆயுதப் பயிற்சி முகாம்'),
      ('et_03', 'Demonstration', 'பொது செயல்விளக்கம்', 'Cultural festivals & sports day public displays', 'கலாச்சார விழாக்கள் மற்றும் பொது நிகழ்வுகளில் செயல்விளக்கம்'),
      ('et_04', 'Workshop', 'ஆயுதப் பயிலரங்கம்', 'Specialized weapon training: Maduvu, Surul Vaal, Katti', 'மான் கொம்பு, சுருள்வாள், கத்தி சிறப்புப் பயிலரங்கம்'),
      ('et_05', 'Tournament', 'மாநில சாம்பியன்ஷிப்', 'Tamil Nadu State Silambam Championship Tournament', 'தமிழ்நாடு மாநில சிலம்ப சாம்பியன்ஷிப் தொடர்')
    `);

    // 10. 5 Realistic Events
    await db.runAsync(`
      INSERT OR REPLACE INTO events (
        id, event_code, name_en, name_ta, event_type_id, event_date, start_time, end_time,
        location_en, location_ta, organizer_en, organizer_ta, description_en, description_ta,
        registration_required, registration_deadline, event_fee, maximum_participants, status
      ) VALUES
      ('ev_01', 'EV-2026-001', 'Tamil Nadu State Silambam Open 2026', 'தமிழ்நாடு மாநில சிலம்ப ஓபன் சாம்பியன்ஷிப் 2026', 'et_01', '2026-10-15', '08:30', '18:00', 'Jawaharlal Nehru Indoor Stadium, Chennai', 'ஜவஹர்லால் நேரு உள்விளையாட்டு அரங்கம், சென்னை', 'Tamil Nadu Silambam Federation', 'தமிழ்நாடு சிலம்ப சம்மேளனம்', 'Annual state-wide competition featuring Single Stick, Double Stick, and Weapon forms.', 'தனி கம்பு, இரட்டை கம்பு, சுருள்வாள் மற்றும் ஆயுதப் பிரிவுகளில் நடைபெறும் மாநில போட்டி.', 1, '2026-10-01', 500.0, 200, 'OPEN'),
      ('ev_02', 'EV-2026-002', 'Traditional Weapons Masterclass (Surul Vaal & Maduvu)', 'பாரம்பரிய சுருள்வாள் & மான் கொம்பு சிறப்புப் பயிற்சி', 'et_04', '2026-09-25', '07:00', '12:00', 'Vagai Silambam Velachery Dojo, Chennai', 'வாகை சிலம்பக்கூடம், வேளச்சேரி, சென்னை', 'Vagai Silambam Academy', 'வாகை சிலம்பம் கழகம்', 'Deep dive into advanced weapons techniques with senior masters.', 'மூத்த ஆசான்களின் வழிகாட்டுதலில் மேம்பட்ட ஆயுதப் பயிற்சி.', 1, '2026-09-20', 350.0, 40, 'OPEN'),
      ('ev_03', 'EV-2026-003', 'Madurai District Inter-School Silambam Cup', 'மதுரை மாவட்ட பள்ளி சிலம்பக் கோப்பை', 'et_01', '2026-11-05', '09:00', '17:00', 'Race Course Stadium, Madurai', 'ரேஸ் கோர்ஸ் அரங்கம், மதுரை', 'Madurai District Sports Council', 'மதுரை மாவட்ட விளையாட்டு மன்றம்', 'Interschool tournament across Under-14, Under-17 and Under-19 categories.', '14, 17 மற்றும் 19 வயதுக்குட்பட்ட பிரிவுகளுக்கான மாவட்ட போட்டி.', 1, '2026-10-28', 250.0, 150, 'OPEN'),
      ('ev_04', 'EV-2026-004', 'Summer Silambam & Porr-Kalai Camp 2026', 'கோடைக்கால சிலம்பம் மற்றும் போர்க்கலை முகாம் 2026', 'et_02', '2026-05-10', '06:00', '11:00', 'YMCA Grounds, Royapettah, Chennai', 'ஒய்.எம்.சி.ஏ மைதானம், ராயப்பேட்டை, சென்னை', 'Vagai Silambam Academy', 'வாகை சிலம்பம் கழகம்', 'Completed 3-week intensive martial arts and fitness boot camp.', 'வெற்றிகரமாக நிறைவடைந்த 3 வார சிறப்புப் பயிற்சி முகாம்.', 1, '2026-05-01', 1200.0, 100, 'COMPLETED'),
      ('ev_05', 'EV-2026-005', 'Pongal Silambam Cultural Grand Demonstration', 'பொங்கல் திருநாள் சிலம்பப் பெருவிழா செயல்விளக்கம்', 'et_03', '2027-01-14', '16:00', '19:30', 'Marina Beach Amphitheatre, Chennai', 'மெரினா கடற்கரை அரங்கம், சென்னை', 'Tamil Nadu Tourism & Vagai Silambam', 'தமிழ்நாடு சுற்றுலாத்துறை & வாகை சிலம்பம்', 'Public showcase of fireworks stick rotation, blindfolded silambam and stick sparring.', 'தீப்பந்த சிலம்பம், கண்கட்டி சிலம்பம் மற்றும் பாரம்பரிய சண்டை முறைகளின் கண்கவர் செயல்விளக்கம்.', 0, NULL, 0.0, 0, 'DRAFT')
    `);

    // 11. Custom Field Builder for Event 1
    await db.runAsync(`
      INSERT OR REPLACE INTO event_custom_fields (id, event_id, field_name_en, field_name_ta, field_type, is_required, sort_order)
      VALUES
      ('cf_01', 'ev_01', 'Weight Category', 'எடைப் பிரிவு', 'DROPDOWN', 1, 1),
      ('cf_02', 'ev_01', 'Silambam Weapon Specialty', 'சிலம்ப ஆயுதப் பிரிவு', 'DROPDOWN', 1, 2),
      ('cf_03', 'ev_01', 'Food & Refreshment Required', 'உணவு ஏற்பாடு தேவையா?', 'CHECKBOX', 0, 3)
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO event_custom_field_options (id, field_id, option_label_en, option_label_ta, option_value, sort_order)
      VALUES
      ('cfo_01', 'cf_01', 'Under 40 kg', '40 கிலோவுக்கு கீழ்', 'U40', 1),
      ('cfo_02', 'cf_01', '40 - 55 kg', '40 முதல் 55 கிலோ', '40_55', 2),
      ('cfo_03', 'cf_01', '55+ kg', '55 கிலோவுக்கு மேல்', '55_PLUS', 3),
      ('cfo_04', 'cf_02', 'Single Stick (ஒற்றை கம்பு)', 'ஒற்றை கம்பு', 'SINGLE_STICK', 1),
      ('cfo_05', 'cf_02', 'Double Stick (இரட்டை கம்பு)', 'இரட்டை கம்பு', 'DOUBLE_STICK', 2),
      ('cfo_06', 'cf_02', 'Surul Vaal (சுருள்வாள்)', 'சுருள்வாள்', 'SURUL_VAAL', 3)
    `);

    // 12. Event Registrations & Results
    await db.runAsync(`
      INSERT OR REPLACE INTO event_registrations (
        id, registration_code, event_id, student_id, registration_date, category, age_category,
        registration_status, participation_status
      ) VALUES
      ('reg_01', 'VSE-2026-00001', 'ev_01', 'stu_01', '2026-09-01', 'Single Stick', 'Under-17', 'CONFIRMED', 'NOT_MARKED'),
      ('reg_02', 'VSE-2026-00002', 'ev_01', 'stu_02', '2026-09-02', 'Double Stick', 'Under-17', 'CONFIRMED', 'NOT_MARKED'),
      ('reg_03', 'VSE-2026-00003', 'ev_01', 'stu_03', '2026-09-03', 'Surul Vaal', 'Senior Open', 'CONFIRMED', 'NOT_MARKED'),
      ('reg_04', 'VSE-2026-00004', 'ev_04', 'stu_01', '2026-05-01', 'Full Weapons Bootcamp', 'Youth', 'CONFIRMED', 'PARTICIPATED')
    `);

    // Event Results for Completed Event (ev_04)
    await db.runAsync(`
      INSERT OR REPLACE INTO event_results (
        id, event_id, student_id, category, participation, result, position, medal, remarks
      ) VALUES
      ('res_01', 'ev_04', 'stu_01', 'Summer Bootcamp Final Sparring', 'PARTICIPATED', 'Winner', '1st Place', 'Gold Medal', 'Exceptional footwork and defensive techniques.')
    `);

    // 13. Fee Types
    await db.runAsync(`
      INSERT OR REPLACE INTO fee_types (id, name_en, name_ta, default_amount)
      VALUES
      ('ft_01', 'Monthly Training Fee', 'மாதாந்திர சிலம்பக் கட்டணம்', 1000.0),
      ('ft_02', 'Admission & Academy Registration', 'சேர்க்கை & பதிவு கட்டணம்', 1500.0),
      ('ft_03', 'State Silambam Championship Entry Fee', 'மாநில சிலம்ப போட்டி பதிவுக் கட்டணம்', 500.0),
      ('ft_04', 'Official Practice Uniform & Staff Fee', 'அதிகாரப்பூர்வ சீருடை & கம்பு கட்டணம்', 850.0),
      ('ft_05', 'Belt Grading & Assessment Fee', 'நிலைத் தேர்வு & தகுதிச் சான்றிதழ் கட்டணம்', 600.0)
    `);

    // 14. Fees & Payments
    await db.runAsync(`
      INSERT OR REPLACE INTO fees (id, fee_number, student_id, fee_type_id, description, amount, due_date, status)
      VALUES
      ('fee_01', 'FEE-2026-001', 'stu_01', 'ft_01', 'September 2026 Training Fee', 1000.0, '2026-09-15', 'PAID'),
      ('fee_02', 'FEE-2026-002', 'stu_01', 'ft_03', 'State Silambam Open 2026 Entry Fee', 500.0, '2026-10-01', 'PENDING'),
      ('fee_03', 'FEE-2026-003', 'stu_02', 'ft_01', 'September 2026 Training Fee', 1000.0, '2026-09-15', 'PARTIALLY_PAID'),
      ('fee_04', 'FEE-2026-004', 'stu_04', 'ft_01', 'August 2026 Training Fee', 1000.0, '2026-08-15', 'OVERDUE')
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO payments (id, payment_number, fee_id, student_id, amount, payment_date, payment_method, transaction_reference, remarks, received_by)
      VALUES
      ('pay_01', 'VSP-2026-00001', 'fee_01', 'stu_01', 1000.0, '2026-09-05', 'UPI', 'UPI/62810481920', 'September Fee Paid via GPay', 'R. Meenakshi'),
      ('pay_02', 'VSP-2026-00002', 'fee_03', 'stu_02', 500.0, '2026-09-06', 'CASH', 'CASH-REC-02', 'Part payment received at Madurai dojo', 'V. Manikandan')
    `);

    // 15. Uniform Types & Uniform Issuance
    await db.runAsync(`
      INSERT OR REPLACE INTO uniform_types (id, name_en, name_ta, description_en, description_ta, default_price)
      VALUES
      ('ut_01', 'Traditional Silambam Kurta & Dhoti', 'பாரம்பரிய சிலம்ப குர்தா & வேட்டி', 'Pure cotton white martial uniform with emblem', 'தூய பருத்தி வெள்ளை சிலம்ப சீருடை', 750.0),
      ('ut_02', 'Vagai Silambam Academy T-Shirt', 'வாகை சிலம்ப கழக டி-சர்ட்', 'Breathable sports practice t-shirt', 'பயிற்சிக்கான பிரத்யேக டி-சர்ட்', 350.0),
      ('ut_03', 'Silambam Bamboo Staff (Siruvazhai)', 'பாரம்பரிய சிறுவாழை சிலம்பக் கம்பு', 'Treated flexible 5.5ft traditional bamboo stick', 'பதப்படுத்தப்பட்ட 5.5 அடி சிலம்பக் கம்பு', 250.0),
      ('ut_04', 'Grading Sash / Belt (Yellow/Green/Black)', 'நிலைத் தேர்வு கச்சை / பெல்ட்', 'Official colored grading rank sash', 'அதிகாரப்பூர்வ சிலம்ப தர கச்சை', 150.0)
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO uniforms (
        id, uniform_number, student_id, uniform_type_id, size, quantity, issue_date, amount, payment_status, condition, remarks
      ) VALUES
      ('uni_01', 'UNI-2026-001', 'stu_01', 'ut_01', 'L', 1, '2026-01-15', 750.0, 'PAID', 'GOOD', 'Issued during enrollment'),
      ('uni_02', 'UNI-2026-002', 'stu_01', 'ut_03', '5.5ft', 2, '2026-01-15', 500.0, 'PAID', 'GOOD', 'Pair of Siruvazhai bamboo staffs'),
      ('uni_03', 'UNI-2026-003', 'stu_02', 'ut_02', 'M', 1, '2026-02-10', 350.0, 'PAID', 'NEW', 'Academy t-shirt')
    `);

    // 16. Achievements & Certificates
    await db.runAsync(`
      INSERT OR REPLACE INTO achievements (
        id, student_id, event_id, achievement_type, title_en, title_ta, position, achievement_date, description_en, description_ta
      ) VALUES
      ('ach_01', 'stu_01', 'ev_04', 'Competition', '1st Place in Single Stick Sparring', 'ஒற்றை கம்பு சண்டை பிரிவில் முதலிடம்', '1st Place', '2026-05-10', 'Secured Gold in Summer Bootcamp Sparring League.', 'கோடைக்கால சிலம்ப முகாம் சண்டை போட்டியில் தங்கப் பதக்கம் வென்றார்.'),
      ('ach_02', 'stu_03', NULL, 'State Award', 'Veera Silambam State Best Fighter Award', 'வீர சிலம்பம் மாநில சிறந்த வீரர் விருது', 'Special Award', '2025-12-20', 'Awarded for mastery of Surul Vaal weapons demonstration.', 'சுருள்வாள் ஆயுத கலை வெளிப்பாட்டுக்கான சிறப்பு விருது.')
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO certificates (
        id, certificate_number, student_id, achievement_id, certificate_title_en, certificate_title_ta, issue_date, file_url, remarks
      ) VALUES
      ('cert_01', 'CERT-VS-2026-0001', 'stu_01', 'ach_01', 'Certificate of Silambam Excellence - Gold Medalist', 'சிலம்ப சிறப்புச் சான்றிதழ் - தங்கப் பதக்கம்', '2026-05-12', 'file:///documents/cert_01.pdf', 'Signed by Asan Senthilvel'),
      ('cert_02', 'CERT-VS-2026-0002', 'stu_01', NULL, 'Green Belt Level Grading Certificate', 'பச்சை கச்சை நிலைத் தேர்வு சான்றிதழ்', '2026-06-30', 'file:///documents/cert_02.pdf', 'Level 3 Silambam Rank')
    `);

    // 17. Notifications
    await db.runAsync(`
      INSERT OR REPLACE INTO notifications (id, notification_type, title_en, title_ta, message_en, message_ta, reference_type, reference_id)
      VALUES
      ('notif_01', 'Attendance', 'Attendance Marked Today', 'இன்றைய வருகை குறிக்கப்பட்டது', 'Morning session attendance for Chennai Head Dojo recorded.', 'சென்னை தலைமை சிலம்பக்கூட காலை அமர்வு வருகை பதிவு செய்யப்பட்டது.', 'attendance_session', 'ses_today_01'),
      ('notif_02', 'Event', 'State Silambam Open 2026 Registrations Open', 'மாநில சிலம்ப போட்டி 2026 பதிவு தொடங்கியது', 'Registration is now open for students. Deadline: Oct 1, 2026.', 'மாணவர்களுக்கான பதிவு தொடங்கியுள்ளது. கடைசி தேதி: அக்டோபர் 1, 2026.', 'event', 'ev_01'),
      ('notif_03', 'Fee', 'Fee Payment Reminder', 'கட்டண நிலுவை நினைவூட்டல்', 'Monthly training fee for September is due soon.', 'செப்டம்பர் மாத சிலம்பப் பயிற்சிக் கட்டணத்தை விரைவில் செலுத்தவும்.', 'fee', 'fee_02')
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO notification_recipients (id, notification_id, user_id, is_read)
      VALUES
      ('nr_01', 'notif_01', 'usr_admin', 1),
      ('nr_02', 'notif_02', 'usr_instructor', 0),
      ('nr_03', 'notif_02', 'usr_student', 0),
      ('nr_04', 'notif_03', 'usr_parent', 0)
    `);

    // 18. Settings
    await db.runAsync(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES
      ('org_name_en', 'Vagai Silambam Academy'),
      ('org_name_ta', 'வாகை சிலம்பம் கழகம்'),
      ('phone', '+91 98401 23456'),
      ('email', 'contact@vagaisilambam.in'),
      ('address_en', 'No 14, Gandhi Salai, Velachery, Chennai, Tamil Nadu 600042'),
      ('address_ta', 'எண் 14, காந்தி சாலை, வேளச்சேரி, சென்னை 600042'),
      ('currency', 'INR (₹)'),
      ('attendance_threshold', '75'),
      ('receipt_prefix', 'VSP-2026-'),
      ('student_id_prefix', 'VS-2026-'),
      ('default_center_id', 'tc_01')
    `);

    // 19. Initial Audit Log
    await db.runAsync(`
      INSERT OR REPLACE INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values)
      VALUES
      ('audit_01', 'usr_admin', 'SYSTEM_INITIALIZED', 'database', 'vagai_silambam.db', '{"status":"seeded","version":"2.0.0"}')
    `);
  });

  console.log('Database seeding finished successfully!');
}
