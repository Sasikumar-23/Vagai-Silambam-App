import datetime
import secrets
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import require_role
from ..auth.security import hash_password
from ..database import get_db
from ..models import AuditLog, License, Organization, Payment, Plan, Student, Subscription, User
from ..services import audit

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class ResetPasswordPayload(BaseModel):
    organization_id: str | None = None
    user_id: str | None = None
    new_password: str



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
    payment_mode: str = "CASH"  # CASH, UPI, DIRECT_TRANSFER
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
    results = []
    for org in orgs:
        sub = db.query(Subscription).filter(Subscription.organization_id == org.id).one_or_none()
        student_count = db.query(Student).filter(Student.organization_id == org.id, Student.student_status == "ACTIVE").count()
        results.append({
            "id": org.id,
            "organization_code": org.organization_code,
            "name": org.name,
            "email": org.email,
            "status": org.status,
            "created_at": org.created_at,
            "plan_code": sub.plan.code if sub and sub.plan else "NONE",
            "subscription_status": sub.status if sub else "NONE",
            "active_students": student_count,
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

    plan = db.query(Plan).filter(Plan.code == payload.plan_code).one_or_none()
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
    Super Admin verifies cash-on-hand / direct offline payment from an academy.
    Atomically:
      1. Logs Payment record with CASH / DIRECT status.
      2. Activates or extends the Academy Subscription with new expiry.
      3. Provisions or ensures an ACTIVE License key.
      4. Writes an Audit Log entry.
    """
    org = db.query(Organization).filter(Organization.id == payload.organization_id).one_or_none()
    if not org:
        raise errors.not_found("Academy / Organization not found")

    plan = db.query(Plan).filter(Plan.code == payload.plan_code).one_or_none()
    if not plan:
        raise errors.not_found("Subscription plan not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    duration_days = payload.duration_months * 30
    expires_at = now + datetime.timedelta(days=duration_days)

    # 1. Update or create subscription
    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).one_or_none()
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
        # If already active and unexpired, extend from current expiry
        if sub.expires_at and sub.expires_at > now:
            sub.expires_at = sub.expires_at + datetime.timedelta(days=duration_days)
            sub.next_billing_date = sub.expires_at
        else:
            sub.subscription_start = now
            sub.expires_at = expires_at
            sub.next_billing_date = expires_at
    db.flush()

    # 2. Record Payment Entry
    receipt_no = payload.receipt_number or f"CASH-{datetime.date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    payment = Payment(
        organization_id=org.id,
        subscription_id=sub.id,
        gateway="offline",
        payment_reference=receipt_no,
        amount=payload.amount,
        currency="INR",
        status="COMPLETED",
        paid_at=now,
    )
    db.add(payment)

    # 3. Ensure ACTIVE academy license key exists
    lic = db.query(License).filter(License.organization_id == org.id, License.status == "ACTIVE").first()
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
            "payment_mode": payload.payment_mode,
            "notes": payload.notes,
        },
        request=request,
    )

    db.commit()

    return {
        "success": True,
        "message": f"Cash payment of ₹{payload.amount} recorded. Subscription activated until {sub.expires_at.strftime('%Y-%m-%d')}.",
        "organization_name": org.name,
        "plan_name": plan.name,
        "status": sub.status,
        "expires_at": sub.expires_at.isoformat(),
        "receipt_number": receipt_no,
        "license_key": lic.license_key,
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


@router.post("/reset-password")
def reset_user_password(
    payload: ResetPasswordPayload,
    request: Request,
    user: User = Depends(require_role("SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    if len(payload.new_password) < 8:
        raise errors.bad_request("WEAK_PASSWORD", "Password must be at least 8 characters")

    target_user = None
    if payload.user_id:
        target_user = db.query(User).filter(User.id == payload.user_id).first()
    elif payload.organization_id:
        # Find organization admin
        target_user = (
            db.query(User)
            .filter(User.organization_id == payload.organization_id, User.role == "ADMIN")
            .first()
        )
        if not target_user:
            target_user = db.query(User).filter(User.organization_id == payload.organization_id).first()

    if not target_user:
        raise errors.not_found("User not found")

    target_user.password_hash = hash_password(payload.new_password)
    audit.record(
        db,
        action="PASSWORD_RESET_BY_SUPERADMIN",
        organization_id=target_user.organization_id,
        user_id=user.id,
        entity_type="users",
        entity_id=target_user.id,
        meta={"username": target_user.username},
        request=request,
    )
    db.commit()
    return {"success": True, "message": f"Password reset for user @{target_user.username}"}

