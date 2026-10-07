# Vagai Silambam — SaaS Conversion Plan

**Status:** Phase 1 (inspection). No application code has been changed for this plan.
**Date:** 2026-10-07

---

## 1. Executive summary

The prompt assumes a web application with a FastAPI backend, server-side SQLite and existing
API endpoints. **None of that exists.** Vagai Silambam today is a single-user Android app:
React Native screens reading and writing a SQLite database that lives on the instructor's
phone. There is no server, no API, no shared database, and no concept of an organization.

The practical consequence is that this is **not a conversion — it is a new product build**.
The existing app is valuable as (a) a complete, working specification of the domain, (b) a
schema that has already been through four migrations, and (c) the source of each academy's
existing data. Nothing in it can be "converted" into a multi-tenant web SaaS; every screen
has to be rebuilt as HTML/CSS/JS against a new API.

Estimated effort: **3–6 months of full-time work.** The 14 phases in the prompt are each
several days to several weeks. This document is Phase 1.

---

## 2. Existing architecture (inspected)

### 2.1 What is actually there

| Layer | Reality |
|---|---|
| Frontend | React Native 0.81 / Expo SDK 54, 19 screens, 10 shared components, ~18,000 lines |
| State/auth | `src/context/AuthContext.tsx` — local accounts in SQLite; sessions in AsyncStorage |
| Data access | 12 repositories in `src/repositories/` calling `expo-sqlite` directly |
| Database | On-device SQLite: **29 tables, 4 views**, 4 migrations in `src/database/migrations/` |
| Backend | **None.** No FastAPI, no Node server, no REST API, no hosted database |
| Google Drive | `src/services/GoogleDriveStorageService.ts` — uploads via the user's own Google account |
| Google Sheets | `src/services/GoogleSheetsAttendanceService.ts` — posts to a user-configured Apps Script URL |
| Auth with Google | `@react-native-google-signin` — currently **is** an application login path |
| Backup | `src/database/backup.ts` — exports/imports every table as a single JSON file |
| Packaging | EAS build, Play Store target, package `com.sasi.vagaisilambam` |

### 2.2 Existing tables (29)

`achievements`, `attendance`, `attendance_sessions`, `audit_logs`, `certificates`,
`documents`, `event_custom_field_options`, `event_custom_field_values`,
`event_custom_fields`, `event_registrations`, `event_results`, `event_types`, `events`,
`fee_types`, `fees`, `instructors`, `notification_recipients`, `notifications`,
`parents_guardians`, `payments`, `roles`, `schema_migrations`, `settings`,
`student_guardians`, `students`, `training_centers`, `uniform_types`, `uniforms`,
`user_roles`, `users`

Views: `student_attendance_summary`, `student_fee_summary`, `event_participant_summary`,
`daily_attendance_summary`.

This schema is good. It is close to third normal form, uses text primary keys, and already
models guardians, custom event fields and audit logs. **It should be carried over to
PostgreSQL almost as-is**, plus tenancy columns.

### 2.3 Problems to fix in the move

1. **No tenancy.** No `organizations` table; every row implicitly belongs to one academy.
2. **No server-side authorization.** Roles are checked in the UI only; there is no API to enforce them.
3. **Weak password hashing.** Salted SHA-256 (`src/utils/password.ts`) — acceptable on-device, not acceptable for a hosted service. Must become bcrypt/argon2.
4. **Per-device data.** Each phone holds a separate, divergent database. There is no "the academy's data" today.
5. **Google integration is per-user and client-side.** Tokens live in AsyncStorage on the phone; the Apps Script URL is pasted in by the user. In SaaS these must move server-side and be encrypted per organization.
6. **No pagination.** Lists load with `LIMIT 100/200`, which is already causing wrong counts.

---

## 3. Conflicts that must be resolved before building

These are contradictions between this prompt and either the current code or decisions taken
in the last few days. **Each needs an explicit answer.**

### 3.1 Attendance storage — direct contradiction

- **This prompt:** "Attendance MUST remain in Google Sheets. DO NOT move attendance into PostgreSQL."
- **Two days ago:** attendance was moved *into* SQLite as the source of truth, and the Google Sheets/Drive sync was deliberately removed, because reports and attendance percentages were reading an empty table and showed 0 for every student. The AsyncStorage copy was also heading for Android's 6 MB cap, which would have silently lost a day's attendance.

Keeping attendance only in Sheets re-creates exactly the problems just fixed, and adds:
- Google Sheets API quotas (~300 writes/min/project) shared across *all* tenants.
- No transactions, no foreign keys, no joins — every report becomes a full-sheet fetch.
- Attendance percentage per student requires reading the whole sheet.

**Recommended:** PostgreSQL is the system of record; Google Sheets is an *optional per-organization
mirror* written by a background job. Customers still get a live Sheet they can open, and
reports stay fast and correct. If you insist on Sheets-only, say so and I will build it that way.

### 3.2 Google Sign-In as application login — direct contradiction

- **This prompt:** "Do NOT add 'Sign in with Google' as the main application login."
- **Current app:** Google Sign-In *is* a login path, and the last several days were spent making it work (Android OAuth clients, SHA-1 fingerprints, consent screen, verified domain).

For the web SaaS this is fine — email/password with JWT, and Google OAuth used *only* to
connect Drive/Sheets. But it means that work applies to the mobile app only.

### 3.3 Google verification for multi-tenant Drive/Sheets

Connecting *customers'* Google accounts means the OAuth app is no longer "internal". Scopes:
- `drive.file` — non-sensitive, fine.
- `spreadsheets` — **sensitive**; requires Google verification (weeks, needs privacy policy, demo video, domain ownership — the domain is already verified).
- If a Sheets-only attendance design needs broader Drive scopes, that escalates to **restricted**, which requires an annual third-party security assessment (US$15k–75k). This is a hard commercial blocker and is a strong argument for §3.1's recommendation.

### 3.4 The existing Android app

The prompt says build the frontend in HTML/CSS/JS. That leaves the Play Store app in limbo.
Options: (a) retire it, (b) keep it as a separate offline product, (c) rebuild it later as a
thin client of the new API. This decides whether the Play Store release continues.

---

## 4. Target architecture

```
Browser (HTML5 / CSS3 / vanilla JS, Tailwind via CDN)
        | HTTPS, JWT in HttpOnly cookie
FastAPI (Python 3.12, SQLAlchemy 2.x, Alembic)
        |
        +-- PostgreSQL 16          <- system of record, row-level tenant isolation
        +-- Razorpay               <- subscriptions, webhooks
        +-- Google Drive API       <- per-organization OAuth, files
        +-- Google Sheets API      <- optional attendance mirror
        +-- APScheduler/Celery     <- trial reminders, billing retries, Sheets sync
```

Backend layout (as specified):

```
backend/app/
  main.py  config.py  database.py
  models/  schemas/  routers/  services/  middleware/  auth/
  integrations/{google_drive.py,google_sheets.py,razorpay.py}
  utils/  tests/
```

---

## 5. Database plan

### 5.1 Carry over

All 29 tables port to PostgreSQL with: `TEXT` ids kept (preserves existing data), `INTEGER`
booleans becoming `BOOLEAN`, `TEXT` timestamps becoming `TIMESTAMPTZ`, and the 4 views
rewritten as PostgreSQL views.

### 5.2 Add tenancy

Every business table gains `organization_id TEXT NOT NULL REFERENCES organizations(id)`,
with a composite index `(organization_id, <primary filter column>)`.

Tables affected: students, parents_guardians, student_guardians, attendance,
attendance_sessions, events, event_*, fees, payments, fee_types, uniforms, uniform_types,
achievements, certificates, documents, notifications, notification_recipients, users,
instructors, training_centers (branches), audit_logs, settings.

### 5.3 New SaaS tables

| Table | Purpose |
|---|---|
| `organizations` | tenant root: code, name, owner, logo, status |
| `plans` | STARTER…ENTERPRISE with `max_students`, `max_branches`, `max_users`, monthly/annual price — **limits in data, never hardcoded** |
| `subscriptions` | plan, status, billing cycle, trial/subscription dates, next billing |
| `licenses` | `VS-XXXX-XXXX-XXXX` from `secrets.token_bytes`, never sequential |
| `payments`, `payment_events` | Razorpay records + raw webhook events for idempotency |
| `google_connections` | per-org encrypted OAuth tokens, folder ids, spreadsheet id |
| `usage_snapshots` | periodic student/branch/user counts for the admin panel |
| `invitations` | staff invites |

### 5.4 Isolation enforcement (two layers)

1. Every query goes through a repository that takes `organization_id` from the **JWT**, never from the request body or query string.
2. PostgreSQL **row-level security** with `SET LOCAL app.current_org` per request, so a missed `WHERE` clause still cannot leak another tenant's rows.

### 5.5 Migrating each academy's existing data

Because the data is on phones, not a server:

1. In the mobile app: Settings → Backup → produces the existing JSON export.
2. New endpoint `POST /api/v1/import/legacy-backup` accepts that JSON.
3. `scripts/import_legacy_backup.py` validates it, creates or selects the organization, stamps `organization_id` on every row, preserves ids, and reports per-table counts in/out.
4. Verification: row counts, foreign key integrity, spot-check of 10 students' attendance and fee totals before and after.
5. The phone's SQLite file is never deleted; the app keeps working until the academy switches.

---

## 6. Frontend plan

19 React Native screens map to pages:

| Existing screen | New page |
|---|---|
| LoginScreen | `login.html`, `register.html` |
| DashboardScreen | `dashboard.html` |
| StudentsScreen, StudentProfileScreen, AddStudentWizardScreen | `students.html`, `student-profile.html` |
| TakeAttendanceScreen, AttendanceHistoryScreen | `attendance.html` |
| EventsScreen, CreateEventScreen, EventDetailScreen | `events.html`, `event-registration.html` |
| FeesScreen, CollectPaymentScreen | `fees.html` |
| UniformsScreen | `uniforms.html` |
| AchievementsScreen, CertificatesScreen | `achievements.html`, `certificates.html` |
| ReportsScreen | `reports.html` |
| SettingsScreen, MoreScreen, NotificationsScreen | `settings.html`, `subscription.html`, `notifications.html` |

Plus `admin/` (8 pages) and the marketing site (11 pages).

Shared: `assets/js/api.js` (fetch wrapper, error codes, 401 handling), `auth.js`, `i18n.js`
with a single `translations.json` — `data-i18n` attributes only, no Tamil strings inside
page markup. The existing `src/i18n/{en,ta}.ts` files port directly into that JSON.

Design: carry over the existing navy/mint design tokens so the web product looks like the
app. The design system is already documented in `design/ui-preview.html`.

---

## 7. Security plan

- argon2id password hashing (replacing the app's SHA-256), rate-limited login, account lockout.
- JWT access token (short) + refresh token in an HttpOnly, Secure, SameSite=Lax cookie; CSRF token for state-changing requests.
- RBAC: ADMIN / INSTRUCTOR / STAFF / ACCOUNTANT per organization, SUPER_ADMIN on the platform, enforced in a FastAPI dependency, not in the UI.
- Subscription gate dependency: authentication → user active → org active → subscription/trial valid → plan limit, returning structured errors (`PLAN_LIMIT_REACHED`, `SUBSCRIPTION_SUSPENDED`).
- Google OAuth tokens encrypted at rest (Fernet/KMS); secrets only in environment variables; `.env.example` committed, `.env` never.
- Razorpay webhooks: HMAC signature verified, event id stored for idempotency, processed in a transaction.
- Input validation via Pydantic; SQLAlchemy bound parameters only; output escaping in the frontend; strict CORS allowlist; security headers via middleware.
- Audit log for every sensitive action, with no passwords or tokens recorded.

---

## 8. Payments

Razorpay Subscriptions. Plan → order → checkout → webhook (`subscription.charged`,
`payment.failed`, `subscription.halted`) → state machine:

`TRIAL → ACTIVE → PAST_DUE → GRACE_PERIOD → SUSPENDED`, with `CANCELLED` / `EXPIRED`, and
reactivation on successful payment. **Frontend payment success is never trusted.** Customer
data is never deleted on expiry.

---

## 9. Deployment

`app.vagaisilambam.com` (static frontend via Nginx), `api.vagaisilambam.com` (FastAPI behind
Gunicorn/Uvicorn), `www.vagaisilambam.com` (marketing). Managed PostgreSQL with daily backups
and tested restores, Let's Encrypt TLS, Docker Compose or a single VPS to start.

Running costs: roughly ₹2,000–6,000/month for a small VPS + managed Postgres + domain, before
Razorpay fees (2% + GST per transaction).

---

## 10. Testing

pytest + httpx. The mandatory test, per the prompt: create Organization A and Organization B,
then assert that every endpoint returns 403/404 for cross-tenant ids — at API level **and**
with a direct database check that RLS blocks the query. Plus auth, RBAC, plan limits, trial
expiry, webhook signature + replay/idempotency, Google OAuth refresh, and the legacy import
script against a real exported backup.

---

## 11. Phased roadmap

| Phase | Work | Rough effort |
|---|---|---|
| 1 | Inspection + this plan | done |
| 2 | FastAPI skeleton, Postgres schema, Alembic, auth, RBAC | 2–3 weeks |
| 3 | Tenancy + RLS + organizations/branches | 1–2 weeks |
| 4 | Port domain modules (students, attendance, events, fees, uniforms, achievements, certificates, reports) | 4–6 weeks |
| 5 | Frontend shell, i18n, dashboard, then page-by-page | 5–8 weeks |
| 6 | Plans, subscriptions, trials, licenses, limit enforcement | 2 weeks |
| 7 | Razorpay + webhooks | 1–2 weeks |
| 8 | Google OAuth per org, Drive folders, optional Sheets mirror | 2 weeks |
| 9 | Super Admin panel | 1–2 weeks |
| 10 | Marketing site + signup/onboarding wizard | 1–2 weeks |
| 11 | Legacy import tooling + data verification | 1 week |
| 12 | Security audit, pen-test pass, fixes | 1–2 weeks |
| 13 | Test suite completion | ongoing |
| 14 | Deployment, monitoring, backups, production checklist | 1 week |

---

## 12. Decisions needed before Phase 2

1. **Attendance:** PostgreSQL as record with optional Sheets mirror (recommended), or Sheets-only as the prompt states?
2. **The Android app:** retire, keep as a separate offline product, or later rebuild as an API client? Does the Play Store release continue meanwhile?
3. **Scope sequencing:** build the full platform, or a thinner first release (auth + tenancy + students + attendance + fees + billing) to get a paying customer sooner?
4. **Infrastructure:** who owns hosting, domain, Razorpay KYC and the Google verification submission?

Until (1) and (2) are answered, Phase 2 should not start: they change the schema and the
Google scope strategy, which are the two hardest things to reverse later.
