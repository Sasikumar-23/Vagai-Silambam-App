import datetime
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..database import get_db
from ..models import Organization, Student, Subscription, Uniform, User
from ..schemas import UniformCreate, UniformOut, UniformUpdate
from ..services import audit

router = APIRouter(prefix="/api/v1/uniforms", tags=["uniforms"])


@router.get("", response_model=list[UniformOut])
def list_uniforms(
    student_id: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Uniform).filter(Uniform.organization_id == organization.id)
    if student_id:
        query = query.filter(Uniform.student_id == student_id)
    if status:
        query = query.filter(Uniform.status == status)
    return query.order_by(Uniform.created_at.desc()).limit(limit).all()


@router.post("", response_model=UniformOut, status_code=201)
def order_uniform(
    payload: UniformCreate,
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

    order_date = payload.order_date or datetime.date.today().isoformat()
    uni = Uniform(
        organization_id=organization.id,
        order_date=order_date,
        **payload.model_dump(exclude={"order_date"}),
    )
    db.add(uni)
    db.flush()

    audit.record(
        db,
        action="UNIFORM_ORDERED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="uniforms",
        entity_id=uni.id,
        request=request,
    )
    db.commit()
    return uni


@router.patch("/{uniform_id}", response_model=UniformOut)
def update_uniform(
    uniform_id: str,
    payload: UniformUpdate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    uni = (
        db.query(Uniform)
        .filter(Uniform.id == uniform_id, Uniform.organization_id == organization.id)
        .one_or_none()
    )
    if not uni:
        raise errors.not_found("Uniform record not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(uni, k, v)

    audit.record(
        db,
        action="UNIFORM_UPDATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="uniforms",
        entity_id=uni.id,
        request=request,
    )
    db.commit()
    return uni
