# Vagai Silambam Mobile App (வாகை சிலம்பம்)
### Production-Ready Silambam Student & Training Management Mobile Application

A modern, high-performance, offline-first mobile application designed specifically for Silambam martial arts training organizations in Tamil Nadu, India.

---

## 🥋 Core Highlights & Workflows

- **Bilingual Experience**: Complete English and Tamil (தமிழ்) Unicode-compliant localization across all labels, screens, reports, and **individual separate input fields for English and Tamil** in student enrollment and event builder forms.
- **Ultra-Fast Attendance**: Mobile-optimized one-tap workflow: **Select Center & Session → Tap 'MARK ALL PRESENT' or Individual (P/A/L/Lv) → Save**.
- **Offline-First SQLite**: Local storage with `vagai_silambam.db`, WAL journal mode, and active foreign key constraints.
- **Role-Aware Dynamic Navigation**: Customized bottom navigation bars and permissions tailored for **Admin**, **Instructor (Asan)**, **Staff/Accountant**, **Student**, and **Parent**.
- **Complete Silambam Lifecycle**:
  `Students → Training → Attendance → Events → Event Participation → Fees → Uniforms → Achievements/Certificates → Reports`

---

## 🏛 Architecture Overview

```
src/
├── theme/                # Silambam sport theme (Navy #1A3673, Jade #00A86B, Gold #D97706)
├── i18n/                 # Centralized English (en.ts) & Tamil (ta.ts) translations
├── models/               # TypeScript domain models and interfaces
├── database/
│   ├── connection.ts     # SQLite singleton with PRAGMA foreign_keys = ON & WAL mode
│   ├── migrations/       # Versioned migration engine (001_initial_schema, 002_indexes_and_views)
│   ├── seed/             # Development seed generator with realistic demo data
│   └── backup.ts         # Safe backup & restore validation utility
├── repositories/         # Typed data access layer with transactions and sequence generators
│   ├── StudentRepository.ts       # Sequential IDs (VS-2026-0001) & Guardian linking
│   ├── AttendanceRepository.ts    # Fast bulk attendance with duplicate prevention
│   ├── EventRepository.ts         # Registration codes (VSE-2026-00001) & auto-achievements
│   ├── FeeRepository.ts           # Overpayment protection & receipts (VSP-2026-00001)
│   ├── UniformRepository.ts       # Inventory, sizing, returns & condition tracking
│   ├── AchievementRepository.ts   # Trophies, medals, and state honours
│   ├── CertificateRepository.ts   # Rank grading certificates (CERT-VS-2026-0001)
│   ├── NotificationRepository.ts  # In-app alerts & unread counters
│   ├── SettingsRepository.ts      # Organization preferences & prefixes
│   ├── UserRepository.ts          # Authentication and role verification
│   └── AuditRepository.ts         # Comprehensive JSON audit trail
├── services/             # Business logic & ReportService (CSV export & sharing)
├── components/           # Mobile UI components (>=48px touch targets, bilingual inputs)
├── screens/              # 18 mobile screens covering all operational flows
├── context/              # AuthContext (session & active role switcher)
├── navigation/           # RoleAwareBottomTabs & RootNavigator
└── tests/                # 13 automated test suites covering all business rules
```

---

## 📊 Database Schema & Views (`vagai_silambam.db`)

### 29 Normalized Tables
1. `roles`
2. `users`
3. `user_roles`
4. `training_centers`
5. `instructors`
6. `students` (Student ID unique constraint)
7. `parents_guardians`
8. `student_guardians` (Many-to-Many)
9. `attendance_sessions`
10. `attendance` (UNIQUE constraint on `session_id + student_id`)
11. `event_types`
12. `events`
13. `event_custom_fields` (Dynamic Field Builder)
14. `event_custom_field_options`
15. `event_custom_field_values`
16. `event_registrations` (UNIQUE constraint on `event_id + student_id`)
17. `event_results`
18. `fee_types`
19. `fees`
20. `payments` (Receipt number unique constraint)
21. `uniform_types`
22. `uniforms`
23. `achievements`
24. `certificates` (Certificate number unique constraint)
25. `documents` (Metadata and references only, no large binaries in DB)
26. `notifications`
27. `notification_recipients`
28. `audit_logs` (Stores `old_values` and `new_values` as JSON)
29. `settings`

### SQLite Views
- `student_attendance_summary`: Calculated attendance percentage: `(Present + Late) / (Total - Leave) * 100`
- `student_fee_summary`: Source-of-truth calculations: `remaining = total_amount - SUM(payments)`
- `event_participant_summary`: Active registration counts per tournament/event
- `daily_attendance_summary`: Aggregated daily presence, absence, late, and leave metrics

---

## 👤 User Roles & Default Test Accounts

| Role | Username | Password | Key Permissions & Navigation |
|---|---|---|---|
| **ADMIN** | `admin` | `admin123` | Full access to all screens, centers, events, custom fields, and reports |
| **INSTRUCTOR** | `instructor` | `inst123` | Dashboard, Students, Quick 1-Tap Attendance, Events, Results |
| **STAFF** | `staff` | `staff123` | Dashboard, Students, Fee Register, Payment Receipts, Uniforms |
| **STUDENT** | `student` | `student123` | Home, Personal Attendance %, Event Registrations, Fees, Profile |
| **PARENT** | `parent` | `parent123` | Home, Child Profile, Child Attendance, Fees, Event Updates |

*Note: On the Login Screen and More Screen, a quick 1-tap role selector is available to seamlessly test and demonstrate each role's view.*

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go on Android / iOS or an Android/iOS Emulator

### Installation
```bash
# Clone the repository and navigate into the folder
npm install
```

### Start Development Server
```bash
# Start Expo development bundler
npx expo start
```

- Press `a` to open in Android Emulator
- Press `i` to open in iOS Simulator
- Scan the QR code with the **Expo Go** app on your physical device

### TypeScript Typecheck
```bash
npm run typecheck
```

---

## 🧪 Testing & Verification

### Running In-App Automated Tests
1. Open the application.
2. Navigate to **More → Settings**.
3. Scroll to the **Local Database** section.
4. Tap **Run All Automated Tests**.
5. All 13 test suites will execute in real-time, verifying:
   - Database connection & migration execution
   - Student CRUD & sequential ID generation (`VS-2026-XXXX`)
   - Duplicate student ID rejection
   - Attendance session creation & bulk marking
   - Duplicate attendance protection (updates existing session marks)
   - Event registration capacity limit & duplicate registration rejection
   - Event result entry with automatic achievement record generation
   - Fee calculation, partial payment, and overpayment prevention
   - Uniform item issuance & condition updates
   - Certificate issuance with unique numbering (`CERT-VS-2026-XXXX`)
   - Backup creation, validation, and safe restore
   - Authentication & role credentials verification

---

## 💾 Backup & Restore

### Database Backup
1. Go to **Settings**.
2. Tap **Backup Database (JSON / Data)**.
3. The app exports a validated snapshot of all 29 tables and triggers native device sharing (AirDrop, WhatsApp, Google Drive, or File Save).

### Reset to Fresh Seed Data
1. Go to **Settings**.
2. Tap **Reset to Seed Data**.
3. The database is repopulated with development testing data (2 training centers, 10 practitioners, sample attendance history, 5 tournaments, fees, payments, uniforms, and achievements).

---

## 📱 Production Build Commands

### Android APK / AAB (via EAS)
```bash
# Preview APK for testing on physical Android devices
npx eas build -p android --profile preview

# Production Android App Bundle (AAB) for Google Play Store
npx eas build -p android --profile production
```

### iOS IPA (via EAS)
```bash
# Simulator build
npx eas build -p ios --profile preview

# Production IPA for Apple App Store / TestFlight
npx eas build -p ios --profile production
```

---

## 🛡 Business Rules Enforced
1. **Student IDs**: Formatted as `VS-YYYY-XXXX` and enforced UNIQUE.
2. **Payment Receipt Numbers**: Formatted as `VSP-YYYY-XXXXX` and enforced UNIQUE.
3. **Event Registration Codes**: Formatted as `VSE-YYYY-XXXXX` and enforced UNIQUE.
4. **No Frontend Fee Calculations**: Remaining balance is always computed from payments in SQLite (`amount - SUM(payments)`).
5. **Overpayment Prevention**: Payments exceeding remaining balance are rejected.
6. **Attendance Uniqueness**: Unique constraint on `(session_id, student_id)` prevents duplicate records.
7. **Bilingual Forms**: Form entries provide dedicated individual English and Tamil input fields.
8. **Audit Trail**: All administrative and financial operations write to the `audit_logs` table.
