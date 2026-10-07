from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, get_current_user, require_active_subscription, require_role
from ..database import get_db
from ..models import Organization, Student, Subscription, User
from ..schemas import PageMeta, StudentCreate, StudentOut, StudentPage, StudentUpdate
from ..services import audit, limits

router = APIRouter(prefix="/api/v1/students", tags=["students"])


def _get_owned_student(db: Session, organization_id: str, student_id: str) -> Student:
    """
    Always filter by organization as well as id. Looking the row up by id alone
    and comparing afterwards is how IDOR bugs happen.
    """
    student = (
        db.query(Student)
        .filter(Student.id == student_id, Student.organization_id == organization_id)
        .one_or_none()
    )
    if student is None:
        raise errors.not_found("Student not found")
    return student


@router.get("", response_model=StudentPage)
def list_students(
    search: str | None = None,
    status: str | None = Query(default=None, pattern="^(ACTIVE|INACTIVE)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Student).filter(Student.organization_id == organization.id)

    if status:
        query = query.filter(Student.student_status == status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name_en.ilike(pattern),
                Student.name_ta.ilike(pattern),
                Student.student_code.ilike(pattern),
                Student.roll_number.ilike(pattern),
                Student.contact_number.ilike(pattern),
            )
        )

    total = query.with_entities(func.count(Student.id)).scalar() or 0
    items = query.order_by(Student.name_en).limit(limit).offset(offset).all()
    return StudentPage(items=items, meta=PageMeta(total=total, limit=limit, offset=offset))


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    subscription: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR", "STAFF_ACCOUNTANT")),
    db: Session = Depends(get_db),
):
    limits.enforce_limit(db, subscription, organization.id, "students")

    duplicate = (
        db.query(Student)
        .filter(
            Student.organization_id == organization.id,
            Student.student_code == payload.student_code,
        )
        .first()
    )
    if duplicate:
        raise errors.conflict("STUDENT_CODE_TAKEN", "A student with this ID already exists")

    student = Student(organization_id=organization.id, **payload.model_dump())
    db.add(student)
    db.flush()

    audit.record(
        db,
        action="STUDENT_CREATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="students",
        entity_id=student.id,
        meta={"student_code": student.student_code},
        request=request,
    )
    db.commit()
    return student


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: str,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    return _get_owned_student(db, organization.id, student_id)


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: str,
    payload: StudentUpdate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR", "STAFF_ACCOUNTANT")),
    db: Session = Depends(get_db),
):
    student = _get_owned_student(db, organization.id, student_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    audit.record(
        db,
        action="STUDENT_UPDATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="students",
        entity_id=student.id,
        request=request,
    )
    db.commit()
    return student


@router.delete("/{student_id}", status_code=204)
def deactivate_student(
    student_id: str,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Deactivates rather than deletes: academies keep their history."""
    student = _get_owned_student(db, organization.id, student_id)
    student.student_status = "INACTIVE"

    audit.record(
        db,
        action="STUDENT_DEACTIVATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="students",
        entity_id=student.id,
        request=request,
    )
    db.commit()
