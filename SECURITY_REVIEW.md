# SECURITY_REVIEW.md — Vagai Silambam SaaS

## Authentication
| Control | Implementation | Status |
|---|---|---|
| Password hashing | Argon2id via `argon2-cffi` | ✅ |
| JWT signing | HS256, configurable secret | ✅ |
| Access token expiry | 30 minutes (configurable) | ✅ |
| Refresh token expiry | 14 days (configurable) | ✅ |
| Brute-force protection | Rate limiting via `slowapi` | ⚠️ Scaffolded — configure in production |
| Password reset | Not yet implemented | 🔲 |

## Multi-Tenant Isolation
| Control | Implementation | Status |
|---|---|---|
| Tenant ID from token | `organization_id` extracted server-side from JWT | ✅ |
| Frontend org ID ignored | `organization_id` in request body is ignored | ✅ (tested) |
| Cross-tenant read blocked | All queries filter by `organization_id` | ✅ (tested) |
| Cross-tenant write blocked | `_get_owned_*` helpers verify ownership before mutate | ✅ (tested) |
| RLS (second line) | `set_tenant_guc` sets `app.current_org` GUC for PostgreSQL | ⚠️ Policies not yet created in Supabase |
| Super Admin privilege check | Done server-side via `require_role("SUPER_ADMIN")` | ✅ |

## Secrets & Credentials
| Secret | Storage | Status |
|---|---|---|
| `DATABASE_URL` | `.env` (git-ignored) | ✅ |
| `JWT_SECRET` | `.env` (git-ignored) | ✅ |
| `TOKEN_ENCRYPTION_KEY` | `.env` (git-ignored) | ✅ |
| Google OAuth tokens | Encrypted with Fernet before DB storage | ✅ |
| Razorpay keys | `.env` (git-ignored) | ✅ |
| `.gitignore` | `.env`, `.env.*`, `!.env.example` | ✅ |

## Supabase PostgreSQL
- Direct connection uses `sslmode=require` — encrypted in transit.
- Password contains special characters (`*`) — tested: works correctly without URL-encoding in connection string; SQLAlchemy handles it.
- Session pooler available at `aws-0-ap-south-1.pooler.supabase.com:5432` for IPv4-only deployments.
- Supabase project status: Healthy, region: `ap-south-1` (Mumbai).

## Input Validation
- All request bodies validated by Pydantic v2 schemas.
- Pattern validators on `student_code`, dates, status enums.
- File uploads (CSV) decoded with `utf-8-sig` error handling.
- HTML is escaped in all frontend templates.

## Audit Logging
- `audit_logs` table records all mutating actions.
- Includes: `action`, `entity_type`, `entity_id`, `user_id`, `organization_id`, `ip_address`, `meta`.
- Passwords are **never** logged (tested).
- Audit logs are read-only to non-super-admins.

## Known Risks & Recommendations

### HIGH
1. **RLS policies not yet created in Supabase.** Application-level isolation is tested and working, but RLS as a second line of defence should be added. Example:
   ```sql
   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON students
     USING (organization_id = current_setting('app.current_org', TRUE));
   ```
2. **No password reset flow.** Users who forget their password cannot self-recover. Implement email-based reset before production.

### MEDIUM
3. **Razorpay webhooks not yet verified.** The `RAZORPAY_WEBHOOK_SECRET` is configured but the signature verification handler needs to be completed before accepting live payments.
4. **Rate limiting not applied to all endpoints.** Currently `slowapi` is installed but not wired. Apply `@limiter.limit("5/minute")` to `/auth/login` and `/auth/register` minimum.
5. **Google OAuth app not verified by Google.** Multi-tenant Drive/Sheets access requires Google verification for production (scopes: `drive.file`, `spreadsheets`).

### LOW
6. **Session pooler for serverless deployments.** If deploying to a serverless platform (e.g., Vercel Functions), switch to the transaction pooler (port 6543) and set `pool_size=1`.
7. **Tamil-language XSS.** All Tamil text is escaped in the frontend. Verify third-party fonts/CDNs have SRI hashes in production.

## Deployment Checklist (pre-production)
- [ ] Set `APP_ENV=production` in environment
- [ ] Set `JWT_SECRET` to a random 64-char hex string
- [ ] Set `TOKEN_ENCRYPTION_KEY` to a fresh Fernet key
- [ ] Configure `CORS_ORIGINS` to the production frontend domain only
- [ ] Enable RLS on all tenant-owned tables in Supabase
- [ ] Enable 2FA on the Supabase project dashboard
- [ ] Restrict Supabase database access to the app's static IP / VPC
- [ ] Complete Razorpay webhook signature verification
- [ ] Implement password reset email flow
- [ ] Run `alembic upgrade head` in staging first, then production
