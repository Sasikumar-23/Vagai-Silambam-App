import datetime
import secrets
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import require_role
from ..database import get_db
from ..models import AuditLog, License, Organization, Payment, Plan, Student, Subscription, User
from ..services import audit

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class UpdatePlanPayload(BaseModel):
    plan_code: str
    status: str | None = None
    expires_at: str | None = None


class VerifyPaymentPayload(BaseModel):
    status: str = "COMPLETED"
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
