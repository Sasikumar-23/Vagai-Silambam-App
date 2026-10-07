# Test Report — Vagai Silambam SaaS

**Run:** 2026-10-07 · `python -m pytest backend/app/tests -q` → **16 passed**
Environment: Python 3.11.8, FastAPI 0.139, SQLAlchemy 2.0.46. Tests execute against
in-memory SQLite because no PostgreSQL server or Docker is available on this machine.

Status key: **PASS** = executed and green · **NOT TESTED** = not yet executed · **N/A** = not built yet.

## Tenant isolation — the critical suite

| Test | Expected | Actual | Status |
|---|---|---|---|
| Org A reads Org B's student by id | 404, no data | 404 `NOT_FOUND` | PASS |
| Student list for A | only A's rows, total excludes B | 1 row, total 1 | PASS |
| Org A updates B's student | rejected, B unchanged | 404, B intact | PASS |
| Org A deactivates B's student | rejected | 404 | PASS |
| Forged `organization_id` in request body | ignored, row stays in caller's org | A=1, B=0 | PASS |
| Request with no token | rejected | 401 | PASS |
| Tampered JWT | rejected | 401 | PASS |
| PostgreSQL row-level security policies | query blocked at DB layer | — | **NOT TESTED** (needs PostgreSQL) |

## Authentication, roles, subscription

| Test | Expected | Actual | Status |
|---|---|---|---|
| Password stored as argon2id, never plaintext | `$argon2id$` prefix | confirmed | PASS |
| Same password → different hashes (salting) | differ | differ | PASS |
| Login with correct / wrong password | 200 / 401 | as expected | PASS |
| Signup provisions trial + license + org code | TRIAL, `VS-ORG-#####`, `VS-XXXX-XXXX-XXXX` | as expected | PASS |
| License keys unpredictable | 500 unique | 500 unique | PASS |
| Plan limit blocks the next student | 402 `PLAN_LIMIT_REACHED`, count unchanged | as expected | PASS |
| Expired trial blocks access, keeps data | 402 `TRIAL_EXPIRED`, rows retained | as expected | PASS |
| Instructor cannot deactivate a student | 403 `FORBIDDEN` | as expected | PASS |
| Suspended organization locked out | 403 `ORGANIZATION_SUSPENDED` | as expected | PASS |
| Audit log excludes passwords | no secret in `meta` | confirmed | PASS |

## Google OAuth, Drive and Sheets attendance (2026-10-07)

**29 new tests, all passing** (`backend/app/tests/test_crypto.py`,
`test_google_integration_units.py`, `test_google_oauth_router.py`,
`test_attendance_router.py`). Google Drive and Sheets calls are replaced with an
in-memory fake (`app/tests/fakes/google_api.py`) shaped like the real API —
there is no Google account configured in this environment, so this proves the
*logic* (idempotent provisioning, upsert, retry, tenant filtering), not a real
network round trip to Google. See "Not tested" below for what that leaves open.

| Test | Expected | Actual | Status |
|---|---|---|---|
| Token round-trip, differs each encryption, tampered/wrong-key ciphertext rejected | encrypt/decrypt correct, no plaintext leak | confirmed | PASS |
| Retry: 429 twice then success | 3rd attempt succeeds | confirmed | PASS |
| Retry: exhausts attempts on persistent 503 | raises after max attempts | confirmed | PASS |
| Retry: 404 (non-retryable) | raises on first attempt, no sleep | confirmed | PASS |
| Drive folder provisioning run twice | same folder ids, no duplicates (root + 5 subfolders) | confirmed | PASS |
| Two organizations provisioning folders | distinct root/subfolder ids | confirmed | PASS |
| Spreadsheet provisioning run twice | header written once, not duplicated | confirmed | PASS |
| Mark attendance (new) | row appended with generated `attendance_id` | confirmed | PASS |
| Mark same student+date+session twice | **same row updated, not duplicated**, same `attendance_id` | confirmed | PASS |
| Different session / different student, same day | separate rows | confirmed | PASS |
| `/google/connect` requires ADMIN | 403 for INSTRUCTOR | confirmed | PASS |
| `/google/connect` URL shape | correct endpoint, scopes, `access_type=offline`, signed `state` | confirmed | PASS |
| `/google/callback` with tampered/missing state or code | redirects with `google=error`, no DB write | confirmed | PASS |
| `/google/callback` happy path | connection row created, tokens encrypted (plaintext absent), folders + spreadsheet provisioned | confirmed | PASS |
| `/google/status` before/after connecting | reflects connection state and email | confirmed | PASS |
| `/google/disconnect` with nothing connected | 404 | confirmed | PASS |
| `/google/disconnect` | status → `DISCONNECTED`, tokens cleared | confirmed | PASS |
| Mark attendance with no Google connection | 400 `GOOGLE_NOT_CONNECTED` | confirmed | PASS |
| Mark → read back by date and by student, percentage computed | correct values | confirmed | PASS |
| Mark twice through the API (not just the client) | one row, final status wins | confirmed | PASS |
| **Org A and Org B share one fake spreadsheet "world"; A marks attendance, B marks attendance** | each org's date view shows only its own row | confirmed | PASS |
| Org A tries to mark attendance for Org B's student | 404, nothing written | confirmed | PASS |
| STAFF_ACCOUNTANT cannot mark attendance | 403 | confirmed | PASS |
| Invalid status value | 422 before the service even runs | confirmed | PASS |

The cross-tenant test above is the important one for the Sheets design specifically:
unlike `students` (filtered by a SQL `WHERE organization_id = …`), attendance rows
from every organization can physically sit in the same spreadsheet, so isolation
depends on `services/attendance.py` filtering by `organization_id` in Python. The
test deliberately shares one fake backing store between two organizations to make
sure that filter is what is actually doing the work.

### Not tested — needs a real Google account

- An actual browser consent screen round trip (code exchange, scope grant screen, user clicking "Allow")
- Real Drive/Sheets API behaviour: actual rate limits, real `HttpError` shapes, quota exhaustion
- Refresh-token behaviour against Google's real token endpoint after the 1-hour access token expires
- Revoking a token and confirming Google actually invalidates it
- What happens when a customer manually deletes the spreadsheet or folder from their own Drive

## Not yet built (so not tested)

Razorpay checkout and webhook (signature + idempotency), mobile sync endpoint, reports,
Super Admin panel, legacy SQLite import, Android APK/AAB against the new API, Drive file
upload endpoints for student photos/certificates (the `DriveClient.upload_file` method
exists and is unit-testable the same way, but no router calls it yet).

Web frontend and marketing site were built after the "not yet built" line above was first
written — see the smoke test below and the `Website Att/marketing/` commit.

## Defect found and fixed during this run

`TypeError: can't compare offset-naive and offset-aware datetimes` — SQLite returns naive
timestamps where PostgreSQL returns aware ones, so the trial-expiry check raised a 500
instead of returning `TRIAL_EXPIRED`. Fixed centrally in `app/utils/time.py::as_utc`.
Caught 8 tests; all green afterwards.

## Web frontend ↔ API smoke test (2026-10-07)

Live `uvicorn` on SQLite, exercising exactly the calls `frontend/assets/js/api.js` makes.
**14/14 PASS.**

| Check | Result |
|---|---|
| Register → 201 with tokens | PASS |
| Login → 200 with tokens | PASS |
| Wrong password → 401 `UNAUTHENTICATED` | PASS |
| Subscription payload: TRIAL, Starter, licence `VS-…`, limit 50 | PASS |
| Plans list returns 5 plans | PASS |
| Create student → 201 | PASS |
| Duplicate student code → 409 `STUDENT_CODE_TAKEN` | PASS |
| List students, total correct | PASS |
| Search by English name | PASS |
| Search by Tamil name (அன்பரசு) | PASS |
| Deactivate student → 204 | PASS |
| Deactivated student leaves the ACTIVE list | PASS |
| Request without token → 401 | PASS |
| Invalid signup → 422 `VALIDATION_ERROR` with field list | PASS |

All HTML files in `frontend/` and `marketing/` parse without errors.

**NOT TESTED:** rendering in a real browser (no browser automation available here) —
layout, the mobile drawer, and the language toggle need a visual check.
