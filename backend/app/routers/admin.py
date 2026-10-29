import calendar
import datetime
import secrets
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import errors
from ..auth.deps import require_role
from ..auth.security import hash_password
from ..database import get_db
from ..models import ApiRequestLog, AuditLog, EmailLog, License, Organization, Payment, Plan, Student, Subscription, User
from ..schemas import PlanCreate, PlanUpdate, ResetPasswordRequest
from ..services import audit
from ..services import email as email_service
from ..services.provisioning import generate_license_key, requires_seat_license, users_with_active_license
from ..utils.time import as_utc

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])





class UpdatePlanPayload(BaseModel):
    plan_code: str
    status: str | None = None
    expires_at: str | None = None


class VerifyPaymentPayload(BaseModel):
    status: str = "COMPLETED"
    notes: str | None = None


class RecordOfflinePaymentPayload(BaseModel):
    organization_id: str
    plan_code: str
    amount: float
    duration_months: int = 1  # 1, 3, 6, 12 months
    payment_mode: str = "CASH"  # CASH, UPI, DIRECT_TRANSFER, CHEQUE, OTHER
    status: str = "COMPLETED"  # COMPLETED, PENDING
    receipt_number: str | None = None
    notes: str | None = None



@router.get("/overview")
def get_admin_overview(
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    total_orgs = db.query(Organization).count()
    active_orgs = db.query(Organization).filter(Organization.status == "ACTIVE").count()
    suspended_orgs = db.query(Organization).filter(Organization.status == "SUSPENDED").count()
    total_students = db.query(Student).count()
    total_payments = db.query(Payment).filter(Payment.status == "COMPLETED").count()

    return {
        "total_academies": total_orgs,
        "active_academies": active_orgs,
        "suspended_academies": suspended_orgs,
        "total_students": total_students,
        "completed_payments": total_payments,
    }


@router.get("/organizations")
def list_organizations(
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).limit(limit).all()
    org_ids = [org.id for org in orgs]
    # Three queries total, regardless of how many academies are listed.
    subs = {
        sub.organization_id: sub
        for sub in db.query(Subscription).options(joinedload(Subscription.plan))
        .filter(Subscription.organization_id.in_(org_ids)).all()
    }
    student_counts = dict(
        db.query(Student.organization_id, func.count(Student.id))
        .filter(Student.organization_id.in_(org_ids), Student.student_status == "ACTIVE")
        .group_by(Student.organization_id)
        .all()
    )
    results = []
    for org in orgs:
        sub = subs.get(org.id)
        results.append({
            "id": org.id,
            "organization_code": org.organization_code,
            "name": org.name,
            "email": org.email,
            "phone": org.phone,
            "status": org.status,
            "created_at": org.created_at,
            "plan_code": sub.plan.code if sub and sub.plan else "NONE",
            "subscription_status": sub.status if sub else "NONE",
            "active_students": student_counts.get(org.id, 0),
        })
    return results


@router.post("/organizations/{org_id}/suspend")
def suspend_organization(
    org_id: str,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise errors.not_found("Organization not found")
    org.status = "SUSPENDED"

    audit.record(
        db,
        action="ORGANIZATION_SUSPENDED",
        organization_id=org.id,
        user_id=user.id,
        entity_type="organizations",
        entity_id=org.id,
        request=request,
    )
    db.commit()
    return {"success": True, "status": "SUSPENDED"}


@router.post("/organizations/{org_id}/activate")
def activate_organization(
    org_id: str,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise errors.not_found("Organization not found")
    org.status = "ACTIVE"

    audit.record(
        db,
        action="ORGANIZATION_ACTIVATED",
        organization_id=org.id,
        user_id=user.id,
        entity_type="organizations",
        entity_id=org.id,
        request=request,
    )
    db.commit()
    return {"success": True, "status": "ACTIVE"}


@router.put("/organizations/{org_id}/subscription")
def update_organization_plan(
    org_id: str,
    payload: UpdatePlanPayload,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        raise errors.not_found("Organization not found")

    plan = db.query(Plan).filter(Plan.code == payload.plan_code.strip().upper()).one_or_none()
    if not plan:
        raise errors.not_found("Plan code not found")

    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).one_or_none()
    if not sub:
        sub = Subscription(organization_id=org_id, plan_id=plan.id, status="ACTIVE")
        db.add(sub)
    else:
        sub.plan_id = plan.id
        if payload.status:
            sub.status = payload.status

    # Ensure valid license key exists
    lic = db.query(License).filter(License.organization_id == org_id, License.status == "ACTIVE").first()
    if not lic:
        lic = License(
            organization_id=org_id,
            license_key=f"VS-LIC-{secrets.token_hex(6).upper()}",
            status="ACTIVE",
        )
        db.add(lic)

    audit.record(
        db,
        action="SUBSCRIPTION_MODIFIED_BY_ADMIN",
        organization_id=org.id,
        user_id=user.id,
        entity_type="subscriptions",
        entity_id=sub.id,
        meta={"new_plan": plan.code},
        request=request,
    )
    db.commit()
    return {"success": True, "plan": plan.code, "status": sub.status}


@router.post("/subscriptions/record-offline-payment")
def record_offline_payment(
    payload: RecordOfflinePaymentPayload,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Super Admin records offline / direct payment (Cash on Hand, UPI, Bank Transfer, etc.).
    If COMPLETED:
      1. Logs Payment record with COMPLETED status and timestamp.
      2. Activates or extends the Academy Subscription with new expiry.
      3. Provisions or ensures an ACTIVE License key.
      4. Sends receipt email & writes Audit Log entry.
    If PENDING:
      1. Logs Payment record with PENDING status (awaiting verification).
      2. Writes Audit Log entry.
    """
    if payload.amount <= 0:
        raise errors.bad_request("INVALID_AMOUNT", "Amount must be greater than zero")
    if payload.duration_months not in (1, 3, 6, 12):
        raise errors.bad_request("INVALID_DURATION", "Duration must be 1, 3, 6 or 12 months")

    raw_mode = (payload.payment_mode or "CASH").strip().upper()
    if raw_mode in ("CASH_ON_HAND", "CASH"):
        payment_mode = "CASH"
    elif raw_mode == "UPI":
        payment_mode = "UPI"
    elif raw_mode in ("DIRECT_TRANSFER", "BANK_TRANSFER"):
        payment_mode = "DIRECT_TRANSFER"
    elif raw_mode == "CHEQUE":
        payment_mode = "CHEQUE"
    elif raw_mode == "OTHER":
        payment_mode = "OTHER"
    else:
        payment_mode = raw_mode

    if payment_mode not in ("CASH", "UPI", "DIRECT_TRANSFER", "CHEQUE", "OTHER"):
        raise errors.bad_request("INVALID_PAYMENT_MODE", "Payment mode must be CASH, UPI, DIRECT_TRANSFER, CHEQUE or OTHER")

    status = (payload.status or "COMPLETED").strip().upper()
    if status not in ("COMPLETED", "PENDING"):
        raise errors.bad_request("INVALID_STATUS", "Status must be COMPLETED or PENDING")

    org = db.query(Organization).filter(Organization.id == payload.organization_id).one_or_none()
    if not org:
        raise errors.not_found("Academy / Organization not found")

    plan = db.query(Plan).filter(Plan.code == payload.plan_code.strip().upper()).one_or_none()
    if not plan:
        raise errors.not_found("Subscription plan not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    duration_days = payload.duration_months * 30
    expires_at = now + datetime.timedelta(days=duration_days)

    mode_prefix = "CASH" if payment_mode == "CASH" else ("UPI" if payment_mode == "UPI" else ("BANK" if payment_mode == "DIRECT_TRANSFER" else "OFFLINE"))
    receipt_no = payload.receipt_number or f"{mode_prefix}-{datetime.date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    if db.query(Payment).filter(Payment.payment_reference == receipt_no).first():
        raise errors.conflict("DUPLICATE_RECEIPT", f"Receipt {receipt_no} has already been recorded")

    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).one_or_none()
    lic = None

    if status == "COMPLETED":
        # 1. Update or create active subscription
        if not sub:
            sub = Subscription(
                organization_id=org.id,
                plan_id=plan.id,
                status="ACTIVE",
                subscription_start=now,
                next_billing_date=expires_at,
                expires_at=expires_at,
            )
            db.add(sub)
        else:
            sub.plan_id = plan.id
            sub.status = "ACTIVE"
            if sub.expires_at and as_utc(sub.expires_at) > now:
                sub.expires_at = sub.expires_at + datetime.timedelta(days=duration_days)
                sub.next_billing_date = sub.expires_at
            else:
                sub.subscription_start = now
                sub.expires_at = expires_at
                sub.next_billing_date = expires_at
        db.flush()

        # 2. Record Payment Entry
        payment = Payment(
            organization_id=org.id,
            subscription_id=sub.id,
            gateway=payment_mode.lower(),
            payment_reference=receipt_no,
            amount=payload.amount,
            currency="INR",
            status="COMPLETED",
            paid_at=now,
        )
        db.add(payment)

        # 3. Ensure ACTIVE academy license key exists
        lic = (
            db.query(License)
            .filter(License.organization_id == org.id, License.user_id.is_(None), License.status == "ACTIVE")
            .first()
        )
        if not lic:
            lic = License(
                organization_id=org.id,
                license_key=f"VS-LIC-{secrets.token_hex(6).upper()}",
                status="ACTIVE",
                issued_at=now,
                expires_at=sub.expires_at,
            )
            db.add(lic)
        else:
            lic.expires_at = sub.expires_at

        # 4. Audit Log
        audit.record(
            db,
            action="OFFLINE_PAYMENT_VERIFIED",
            organization_id=org.id,
            user_id=user.id,
            entity_type="payments",
            entity_id=payment.id,
            meta={
                "amount": payload.amount,
                "plan": plan.code,
                "duration_months": payload.duration_months,
                "receipt_number": receipt_no,
                "payment_mode": payment_mode,
                "status": "COMPLETED",
                "notes": payload.notes,
            },
            request=request,
        )
        db.commit()

        email_service.send_cash_receipt(
            db,
            organization=org,
            payment=payment,
            plan=plan,
            license_key=lic.license_key,
            duration_months=payload.duration_months,
            expires_at=sub.expires_at,
        )
        db.commit()

        return {
            "success": True,
            "message": f"Payment of ₹{payload.amount} recorded. Subscription activated until {sub.expires_at.strftime('%Y-%m-%d')}.",
            "organization_name": org.name,
            "plan_name": plan.name,
            "status": sub.status,
            "payment_status": "COMPLETED",
            "expires_at": sub.expires_at.isoformat(),
            "receipt_number": receipt_no,
            "license_key": lic.license_key,
        }
    else:
        # PENDING payment recording
        if not sub:
            sub = Subscription(
                organization_id=org.id,
                plan_id=plan.id,
                status="PENDING",
                subscription_start=now,
            )
            db.add(sub)
            db.flush()

        payment = Payment(
            organization_id=org.id,
            subscription_id=sub.id,
            gateway=payment_mode.lower(),
            payment_reference=receipt_no,
            amount=payload.amount,
            currency="INR",
            status="PENDING",
            paid_at=None,
        )
        db.add(payment)

        audit.record(
            db,
            action="OFFLINE_PAYMENT_PENDING",
            organization_id=org.id,
            user_id=user.id,
            entity_type="payments",
            entity_id=payment.id,
            meta={
                "amount": payload.amount,
                "plan": plan.code,
                "duration_months": payload.duration_months,
                "receipt_number": receipt_no,
                "payment_mode": payment_mode,
                "status": "PENDING",
                "notes": payload.notes,
            },
            request=request,
        )
        db.commit()

        return {
            "success": True,
            "message": f"Payment of ₹{payload.amount} recorded with status PENDING.",
            "organization_name": org.name,
            "plan_name": plan.name,
            "status": sub.status if sub else "PENDING",
            "payment_status": "PENDING",
            "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
            "receipt_number": receipt_no,
            "license_key": None,
        }



@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=200),
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "organization_id": l.organization_id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "meta": l.meta,
            "ip_address": l.ip_address,
            "created_at": l.created_at,
        }
        for l in logs
    ]





@router.post("/users/{user_id}/reset-password", status_code=204)
def super_admin_reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    request: Request,
    admin: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise errors.not_found("User not found")
    target.password_hash = hash_password(payload.new_password)
    audit.record(
        db,
        action="PASSWORD_RESET_BY_SUPER_ADMIN",
        organization_id=target.organization_id,
        user_id=admin.id,
        entity_type="users",
        entity_id=target.id,
        meta={"username": target.username},
        request=request,
    )
    db.commit()


@router.post("/organizations/{org_id}/reset-admin-password", status_code=204)
def super_admin_reset_academy_admin_password(
    org_id: str,
    payload: ResetPasswordRequest,
    request: Request,
    admin: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    organization = db.get(Organization, org_id)
    if organization is None:
        raise errors.not_found("Academy not found")
    target = (
        db.query(User)
        .filter(User.organization_id == org_id, User.role == "ADMIN")
        .order_by(User.created_at)
        .first()
    )
    if target is None:
        raise errors.not_found("This academy has no admin account")
    target.password_hash = hash_password(payload.new_password)
    audit.record(
        db,
        action="PASSWORD_RESET_BY_SUPER_ADMIN",
        organization_id=org_id,
        user_id=admin.id,
        entity_type="users",
        entity_id=target.id,
        meta={"username": target.username},
        request=request,
    )
    db.commit()


class GenerateLicensePayload(BaseModel):
    expires_at: datetime.datetime | None = None


@router.post("/organizations/{org_id}/generate-license")
def generate_academy_license(
    org_id: str,
    payload: GenerateLicensePayload,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Idempotent: returns the academy's active license, issuing one only if none exists."""
    organization = db.get(Organization, org_id)
    if organization is None:
        raise errors.not_found("Academy not found")

    lic = (
        db.query(License)
        .filter(License.organization_id == org_id, License.user_id.is_(None), License.status == "ACTIVE")
        .first()
    )
    if lic is None:
        sub = db.query(Subscription).filter(Subscription.organization_id == org_id).one_or_none()
        lic = License(
            organization_id=org_id,
            license_key=generate_license_key(),
            status="ACTIVE",
            issued_at=datetime.datetime.now(datetime.timezone.utc),
            expires_at=payload.expires_at or (sub.expires_at if sub else None),
        )
        db.add(lic)
        db.flush()
        audit.record(
            db,
            action="ACADEMY_LICENSE_ISSUED",
            organization_id=org_id,
            user_id=user.id,
            entity_type="licenses",
            entity_id=lic.id,
            meta={"expires_at": lic.expires_at.isoformat() if lic.expires_at else None},
            request=request,
        )
        db.commit()
    return {"license_key": lic.license_key, "status": lic.status, "expires_at": lic.expires_at}


def _add_months(start: datetime.datetime, months: int) -> datetime.datetime:
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return start.replace(year=year, month=month, day=min(start.day, last_day))


def _upgrade_expiry(sub: Subscription | None, plan: Plan, months: int, now: datetime.datetime) -> datetime.datetime:
    """Renewing the same paid plan extends the current term; anything else starts a fresh term today."""
    renewing = (
        sub is not None
        and sub.plan_id == plan.id
        and sub.status == "ACTIVE"
        and sub.expires_at is not None
        and as_utc(sub.expires_at) > now
    )
    return _add_months(as_utc(sub.expires_at) if renewing else now, months)


@router.get("/organizations/{org_id}/license-overview")
def academy_license_overview(
    org_id: str,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """What the Upgrade dialog shows once an academy is picked: who owns it, its plan and its license."""
    organization = db.get(Organization, org_id)
    if organization is None:
        raise errors.not_found("Academy not found")
    owner = (
        db.query(User)
        .filter(User.organization_id == org_id, User.role == "ADMIN")
        .order_by(User.created_at)
        .first()
    )
    sub = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.organization_id == org_id)
        .one_or_none()
    )
    lic = (
        db.query(License)
        .filter(License.organization_id == org_id, License.user_id.is_(None), License.status == "ACTIVE")
        .first()
    )
    return {
        "organization_id": org_id,
        "organization_name": organization.name,
        "admin": {
            "full_name_en": owner.full_name_en,
            "username": owner.username,
            "email": owner.email,
            "phone": owner.phone,
        } if owner else None,
        "plan_code": sub.plan.code if sub and sub.plan else None,
        "subscription_status": sub.status if sub else None,
        "expires_at": sub.expires_at if sub else None,
        "license_key": lic.license_key if lic else None,
    }


class UpgradePayload(BaseModel):
    plan_code: str
    duration_months: int = 1


@router.post("/organizations/{org_id}/upgrade")
def upgrade_academy(
    org_id: str,
    payload: UpgradePayload,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Moves an academy onto a plan for 1, 3, 6 or 12 months and keeps its academy license in step.
    This grants access only; money received is recorded separately as a payment."""
    if payload.duration_months not in (1, 3, 6, 12):
        raise errors.bad_request("INVALID_DURATION", "Duration must be 1, 3, 6 or 12 months")
    organization = db.get(Organization, org_id)
    if organization is None:
        raise errors.not_found("Academy not found")
    plan = db.query(Plan).filter(Plan.code == payload.plan_code.strip().upper()).one_or_none()
    if plan is None:
        raise errors.not_found("Plan not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).one_or_none()
    expires_at = _upgrade_expiry(sub, plan, payload.duration_months, now)
    previous_plan = sub.plan.code if sub and sub.plan else None

    if sub is None:
        sub = Subscription(organization_id=org_id, plan_id=plan.id)
        db.add(sub)
    if sub.plan_id != plan.id or sub.status != "ACTIVE":
        sub.subscription_start = now
    sub.plan_id = plan.id
    sub.status = "ACTIVE"
    sub.billing_cycle = "ANNUAL" if payload.duration_months == 12 else "MONTHLY"
    sub.expires_at = expires_at
    sub.next_billing_date = expires_at
    db.flush()

    lic = (
        db.query(License)
        .filter(License.organization_id == org_id, License.user_id.is_(None), License.status == "ACTIVE")
        .first()
    )
    if lic is None:
        lic = License(
            organization_id=org_id,
            license_key=generate_license_key(),
            status="ACTIVE",
            issued_at=now,
            expires_at=expires_at,
        )
        db.add(lic)
    else:
        lic.expires_at = expires_at
    db.flush()

    audit.record(
        db,
        action="ACADEMY_UPGRADED",
        organization_id=org_id,
        user_id=user.id,
        entity_type="subscriptions",
        entity_id=sub.id,
        meta={
            "from_plan": previous_plan,
            "to_plan": plan.code,
            "duration_months": payload.duration_months,
            "expires_at": expires_at.isoformat(),
        },
        request=request,
    )
    db.commit()
    return {
        "success": True,
        "plan_code": plan.code,
        "status": sub.status,
        "expires_at": expires_at,
        "license_key": lic.license_key,
    }


@router.get("/licenses")
def list_licenses(
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Academy-wide subscription licenses and per-member seat licenses, newest first."""
    rows = (
        db.query(License, Organization, User)
        .join(Organization, Organization.id == License.organization_id)
        .outerjoin(User, User.id == License.user_id)
        .order_by(License.issued_at.desc())
        .all()
    )
    return [
        {
            "license_id": lic.id,
            "license_key": lic.license_key,
            "scope": "SEAT" if member else "ACADEMY",
            "status": lic.status,
            "issued_at": lic.issued_at,
            "expires_at": lic.expires_at,
            "organization_id": org.id,
            "organization_name": org.name,
            "organization_code": org.organization_code,
            "user_id": member.id if member else None,
            "username": member.username if member else None,
            "full_name_en": member.full_name_en if member else None,
        }
        for lic, org, member in rows
    ]


@router.post("/licenses/{license_id}/revoke")
def revoke_license(
    license_id: str,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    lic = db.get(License, license_id)
    if lic is None:
        raise errors.not_found("License not found")
    if lic.status != "REVOKED":
        lic.status = "REVOKED"
        audit.record(
            db,
            action="LICENSE_REVOKED",
            organization_id=lic.organization_id,
            user_id=user.id,
            entity_type="licenses",
            entity_id=lic.id,
            meta={"scope": "SEAT" if lic.user_id else "ACADEMY"},
            request=request,
        )
        db.commit()
    return {"license_id": lic.id, "status": lic.status}


@router.get("/payments")
def list_payments(
    organization_id: str | None = Query(default=None),
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Payment, Organization)
        .join(Organization, Organization.id == Payment.organization_id)
    )
    if organization_id:
        query = query.filter(Payment.organization_id == organization_id)
    rows = query.order_by(Payment.paid_at.desc().nullslast(), Payment.created_at.desc()).limit(200).all()
    return [
        {
            "id": p.id,
            "organization_name": org.name,
            "organization_code": org.organization_code,
            "amount": p.amount,
            "currency": p.currency,
            "gateway": p.gateway,
            "receipt_number": p.payment_reference,
            "status": p.status,
            "paid_at": p.paid_at,
        }
        for p, org in rows
    ]


@router.post("/payments/{payment_id}/verify")
def verify_payment(
    payment_id: str,
    payload: VerifyPaymentPayload | None = None,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
    request: Request = None,
):
    payment = db.query(Payment).filter(Payment.id == payment_id).one_or_none()
    if not payment:
        raise errors.not_found("Payment record not found")

    if payment.status == "COMPLETED":
        return {"success": True, "message": "Payment is already verified", "status": "COMPLETED"}

    now = datetime.datetime.now(datetime.timezone.utc)
    payment.status = "COMPLETED"
    payment.paid_at = now

    org = db.query(Organization).filter(Organization.id == payment.organization_id).one_or_none()
    sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).one_or_none() if payment.subscription_id else None
    if not sub and org:
        sub = db.query(Subscription).filter(Subscription.organization_id == org.id).one_or_none()

    lic = None
    if org and sub:
        duration_days = 30
        plan = db.query(Plan).filter(Plan.id == sub.plan_id).one_or_none()
        expires_at = now + datetime.timedelta(days=duration_days)
        sub.status = "ACTIVE"
        if sub.expires_at and as_utc(sub.expires_at) > now:
            sub.expires_at = sub.expires_at + datetime.timedelta(days=duration_days)
            sub.next_billing_date = sub.expires_at
        else:
            sub.subscription_start = now
            sub.expires_at = expires_at
            sub.next_billing_date = expires_at

        lic = (
            db.query(License)
            .filter(License.organization_id == org.id, License.user_id.is_(None), License.status == "ACTIVE")
            .first()
        )
        if not lic:
            lic = License(
                organization_id=org.id,
                license_key=f"VS-LIC-{secrets.token_hex(6).upper()}",
                status="ACTIVE",
                issued_at=now,
                expires_at=sub.expires_at,
            )
            db.add(lic)
        else:
            lic.expires_at = sub.expires_at

        db.flush()
        if plan:
            email_service.send_cash_receipt(
                db,
                organization=org,
                payment=payment,
                plan=plan,
                license_key=lic.license_key if lic else "N/A",
                duration_months=1,
                expires_at=sub.expires_at,
            )

    audit.record(
        db,
        action="OFFLINE_PAYMENT_VERIFIED",
        organization_id=payment.organization_id,
        user_id=user.id,
        entity_type="payments",
        entity_id=payment.id,
        meta={"amount": payment.amount, "notes": payload.notes if payload else None},
        request=request,
    )
    db.commit()
    return {"success": True, "message": "Payment verified and subscription activated.", "status": "COMPLETED"}


@router.get("/email-logs")
def list_email_logs(
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(EmailLog, Organization)
        .outerjoin(Organization, Organization.id == EmailLog.organization_id)
        .order_by(EmailLog.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": log.id,
            "organization_name": org.name if org else None,
            "recipient": log.recipient,
            "kind": log.kind,
            "subject": log.subject,
            "reference": log.reference,
            "status": log.status,
            "attempts": log.attempts,
            "last_error": log.last_error,
            "sent_at": log.sent_at,
            "created_at": log.created_at,
        }
        for log, org in rows
    ]


@router.post("/email-logs/retry")
def retry_pending_emails(
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Resends PENDING and FAILED mail only. Payments and licenses are never touched."""
    logs = db.query(EmailLog).filter(EmailLog.status.in_(["PENDING", "FAILED"])).all()
    for log in logs:
        email_service.attempt(db, log)
    db.commit()
    return {
        "attempted": len(logs),
        "sent": sum(1 for log in logs if log.status == "SENT"),
        "still_pending": sum(1 for log in logs if log.status != "SENT"),
    }


def _plan_out(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "max_students": plan.max_students,
        "max_branches": plan.max_branches,
        "max_users": plan.max_users,
        "price_monthly": plan.price_monthly,
        "price_annual": plan.price_annual,
        "sort_order": plan.sort_order,
        "is_active": plan.is_active,
    }


@router.get("/plans")
def list_all_plans(user: User = Depends(require_role("SUPER_ADMIN")), db: Session = Depends(get_db)):
    return [_plan_out(p) for p in db.query(Plan).order_by(Plan.sort_order).all()]


@router.post("/plans", status_code=201)
def create_plan(
    payload: PlanCreate,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    code = payload.code.strip().upper()
    if db.query(Plan).filter(Plan.code == code).first():
        raise errors.conflict("PLAN_CODE_TAKEN", f"A plan with code {code} already exists")
    plan = Plan(
        id=f"plan_{code.lower()}",
        code=code,
        name=payload.name.strip(),
        max_students=payload.max_students,
        max_branches=payload.max_branches,
        max_users=payload.max_users,
        price_monthly=payload.price_monthly,
        price_annual=payload.price_annual,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(plan)
    db.flush()
    audit.record(db, action="PLAN_CREATED", user_id=user.id, entity_type="plans", entity_id=plan.id,
                 meta={"code": code}, request=request)
    db.commit()
    return _plan_out(plan)


@router.put("/plans/{plan_id}")
def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """Code is fixed after creation. Limit and price changes apply to every academy on the plan."""
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise errors.not_found("Plan not found")
    before = _plan_out(plan)
    plan.name = payload.name.strip()
    plan.max_students = payload.max_students
    plan.max_branches = payload.max_branches
    plan.max_users = payload.max_users
    plan.price_monthly = payload.price_monthly
    plan.price_annual = payload.price_annual
    plan.sort_order = payload.sort_order
    plan.is_active = payload.is_active
    audit.record(db, action="PLAN_UPDATED", user_id=user.id, entity_type="plans", entity_id=plan.id,
                 meta={"before": before, "after": _plan_out(plan)}, request=request)
    db.commit()
    return _plan_out(plan)


@router.get("/app-activations")
def list_app_activations(user: User = Depends(require_role("SUPER_ADMIN")), db: Session = Depends(get_db)):
    rows = (
        db.query(User, Organization)
        .outerjoin(Organization, Organization.id == User.organization_id)
        .filter(User.role != "SUPER_ADMIN")
        .order_by(User.last_login_at.desc().nullslast(), User.created_at.desc())
        .limit(500)
        .all()
    )
    seat_user_ids = [u.id for u, _ in rows if requires_seat_license(u)]
    licensed = users_with_active_license(db, seat_user_ids)
    out = []
    for u, org in rows:
        if not requires_seat_license(u):
            license_status = "NOT_REQUIRED"
        else:
            license_status = "ACTIVE" if u.id in licensed else "REVOKED_OR_NONE"
        out.append({
            "user_id": u.id,
            "username": u.username,
            "full_name_en": u.full_name_en,
            "role": u.role,
            "organization_name": org.name if org else None,
            "is_active": u.is_active,
            "last_login_at": u.last_login_at,
            "license_status": license_status,
        })
    return out


@router.get("/api-logs")
def list_api_logs(
    path_contains: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    query = db.query(ApiRequestLog, User).outerjoin(User, User.id == ApiRequestLog.user_id)
    if path_contains:
        query = query.filter(ApiRequestLog.path.contains(path_contains))
    rows = query.order_by(ApiRequestLog.created_at.desc()).limit(limit).all()
    return [
        {
            "method": log.method,
            "path": log.path,
            "username": u.username if u else None,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
        }
        for log, u in rows
    ]
