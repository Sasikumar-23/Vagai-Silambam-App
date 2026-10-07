from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..database import get_db
from ..models import Organization, Subscription, User
from ..schemas import AttendanceMarkRequest, AttendanceMarkResponse, StudentAttendanceSummary
from ..services import attendance, audit

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])


@router.post("", response_model=AttendanceMarkResponse)
def mark(
    payload: AttendanceMarkRequest,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    """
    Writes straight to the organization's Google Sheet — Sheets is the permanent
    store, per the product brief. Marking the same student + date + session twice
    updates the existing row instead of creating a duplicate.
    """
    result = attendance.mark_attendance(
        db, organization,
        student_id=payload.student_id,
        date=payload.date,
        session_name=payload.session_name,
        status=payload.status,
        remarks=payload.remarks,
        marked_by=user.full_name_en,
    )
    audit.record(
        db, action="ATTENDANCE_MARKED", organization_id=organization.id, user_id=user.id,
        entity_type="attendance", entity_id=result["attendance_id"],
        meta={"student_id": payload.student_id, "date": payload.date, "status": payload.status},
        request=request,
    )
    db.commit()
    return result


@router.get("/date/{date}")
def by_date(
    date: str,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    return {"date": date, "records": attendance.attendance_for_date(db, organization, date)}


@router.get("/student/{student_id}", response_model=StudentAttendanceSummary)
def by_student(
    student_id: str,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    return attendance.attendance_for_student(db, organization, student_id)
