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

## Not yet built (so not tested)

Google OAuth connect/callback, Drive folders, **Sheets attendance**, Razorpay checkout and
webhook (signature + idempotency), mobile sync endpoint, reports, Super Admin panel, web
frontend, marketing site, legacy SQLite import, Android APK/AAB against the new API.

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
