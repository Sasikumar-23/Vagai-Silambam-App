import datetime
import secrets
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..database import get_db
from ..models import Fee, Organization, Student, Subscription, User
from ..schemas import FeeCreate, FeeOut, FeePayRequest
from ..services import audit

router = APIRouter(prefix="/api/v1/fees", tags=["fees"])


def _generate_receipt_number(org_code: str) -> str:
    today = datetime.date.today().strftime("%Y%m")
    rnd = secrets.token_hex(3).upper()
    return f"RCP-{org_code}-{today}-{rnd}"


@router.get("", response_model=list[FeeOut])
def list_fees(
    student_id: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Fee).filter(Fee.organization_id == organization.id)
    if student_id:
        query = query.filter(Fee.student_id == student_id)
    if status:
        query = query.filter(Fee.status == status)
    return query.order_by(Fee.created_at.desc()).limit(limit).all()


@router.post("", response_model=FeeOut, status_code=201)
def create_fee(
    payload: FeeCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "STAFF_ACCOUNTANT")),
    db: Session = Depends(get_db),
):
    # Verify student belongs to this organization
    student = (
        db.query(Student)
        .filter(Student.id == payload.student_id, Student.organization_id == organization.id)
        .one_or_none()
    )
    if not student:
        raise errors.not_found("Student not found")

    fee = Fee(organization_id=organization.id, **payload.model_dump())
    db.add(fee)
    db.flush()

    audit.record(
        db,
        action="FEE_RECORD_CREATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="fees",
        entity_id=fee.id,
        meta={"amount": fee.amount, "student_id": fee.student_id},
        request=request,
    )
    db.commit()
    return fee


@router.post("/{fee_id}/pay", response_model=FeeOut)
def record_fee_payment(
    fee_id: str,
    payload: FeePayRequest,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "STAFF_ACCOUNTANT")),
    db: Session = Depends(get_db),
):
    fee = (
        db.query(Fee)
        .filter(Fee.id == fee_id, Fee.organization_id == organization.id)
        .one_or_none()
    )
    if not fee:
        raise errors.not_found("Fee record not found")

    fee.status = "PAID"
    fee.payment_mode = payload.payment_mode
    fee.paid_date = payload.paid_date or datetime.date.today().isoformat()
    fee.receipt_number = payload.receipt_number or _generate_receipt_number(organization.organization_code)
    fee.collected_by = user.id
    if payload.notes:
        fee.notes = (fee.notes or "") + f" | Payment Note: {payload.notes}"

    audit.record(
        db,
        action="FEE_PAID",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="fees",
        entity_id=fee.id,
        meta={"receipt": fee.receipt_number, "amount": fee.amount},
        request=request,
    )
    db.commit()
    return fee
