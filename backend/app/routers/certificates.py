import secrets
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..database import get_db
from ..models import Achievement, Certificate, Organization, Student, Subscription, User
from ..schemas import AchievementCreate, AchievementOut, CertificateCreate, CertificateOut
from ..services import audit

router = APIRouter(prefix="/api/v1/certificates", tags=["certificates"])


@router.get("/achievements", response_model=list[AchievementOut])
def list_achievements(
    student_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Achievement).filter(Achievement.organization_id == organization.id)
    if student_id:
        query = query.filter(Achievement.student_id == student_id)
    return query.order_by(Achievement.achievement_date.desc()).limit(limit).all()


@router.post("/achievements", response_model=AchievementOut, status_code=201)
def add_achievement(
    payload: AchievementCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    student = (
        db.query(Student)
        .filter(Student.id == payload.student_id, Student.organization_id == organization.id)
        .one_or_none()
    )
    if not student:
        raise errors.not_found("Student not found")

    ach = Achievement(organization_id=organization.id, **payload.model_dump())
    db.add(ach)
    db.flush()

    audit.record(
        db,
        action="ACHIEVEMENT_RECORDED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="achievements",
        entity_id=ach.id,
        request=request,
    )
    db.commit()
    return ach


@router.get("", response_model=list[CertificateOut])
def list_certificates(
    student_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Certificate).filter(Certificate.organization_id == organization.id)
    if student_id:
        query = query.filter(Certificate.student_id == student_id)
    return query.order_by(Certificate.issue_date.desc()).limit(limit).all()


@router.post("", response_model=CertificateOut, status_code=201)
def issue_certificate(
    payload: CertificateCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    student = (
        db.query(Student)
        .filter(Student.id == payload.student_id, Student.organization_id == organization.id)
        .one_or_none()
    )
    if not student:
        raise errors.not_found("Student not found")

    # Generate verification code if not provided
    vcode = payload.verification_code or f"VS-VER-{secrets.token_hex(4).upper()}"
    cert = Certificate(
        organization_id=organization.id,
        verification_code=vcode,
        **payload.model_dump(exclude={"verification_code"}),
    )
    db.add(cert)
    db.flush()

    audit.record(
        db,
        action="CERTIFICATE_ISSUED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="certificates",
        entity_id=cert.id,
        request=request,
    )
    db.commit()
    return cert
