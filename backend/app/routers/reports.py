import csv
import io
from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth.deps import get_current_organization, require_active_subscription
from ..database import get_db
from ..models import Event, Fee, Organization, Student, Subscription, Uniform

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/summary")
def get_academy_summary(
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    total_students = (
        db.query(func.count(Student.id))
        .filter(Student.organization_id == organization.id, Student.student_status == "ACTIVE")
        .scalar()
        or 0
    )
    total_fees_collected = (
        db.query(func.sum(Fee.amount))
        .filter(Fee.organization_id == organization.id, Fee.status == "PAID")
        .scalar()
        or 0.0
    )
    pending_fees = (
        db.query(func.sum(Fee.amount))
        .filter(Fee.organization_id == organization.id, Fee.status == "PENDING")
        .scalar()
        or 0.0
    )
    upcoming_events_count = (
        db.query(func.count(Event.id))
        .filter(Event.organization_id == organization.id, Event.status == "UPCOMING")
        .scalar()
        or 0
    )
    pending_uniforms = (
        db.query(func.count(Uniform.id))
        .filter(Uniform.organization_id == organization.id, Uniform.status != "DELIVERED")
        .scalar()
        or 0
    )

    return {
        "active_students": total_students,
        "fees_collected": float(total_fees_collected),
        "pending_fees": float(pending_fees),
        "upcoming_events": upcoming_events_count,
        "pending_uniforms": pending_uniforms,
    }


@router.get("/export/students.csv")
def export_students_csv(
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    students = (
        db.query(Student)
        .filter(Student.organization_id == organization.id)
        .order_by(Student.student_code)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Student Code", "Name (EN)", "Name (TA)", "Roll Number", "Gender",
        "Date of Birth", "Contact", "Training Level", "Status", "Joining Date"
    ])
    for s in students:
        writer.writerow([
            s.student_code, s.name_en, s.name_ta or "", s.roll_number or "", s.gender or "",
            s.date_of_birth or "", s.contact_number or "", s.training_level or "",
            s.student_status, s.joining_date or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=students_{organization.organization_code}.csv"}
    )


@router.get("/export/fees.csv")
def export_fees_csv(
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    fees = (
        db.query(Fee, Student.name_en, Student.student_code)
        .join(Student, Fee.student_id == Student.id)
        .filter(Fee.organization_id == organization.id)
        .order_by(Fee.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Receipt Number", "Student Code", "Student Name", "Fee Title",
        "Amount", "Due Date", "Paid Date", "Payment Mode", "Status"
    ])
    for fee, s_name, s_code in fees:
        writer.writerow([
            fee.receipt_number or "", s_code, s_name, fee.title_en,
            fee.amount, fee.due_date or "", fee.paid_date or "",
            fee.payment_mode or "", fee.status
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fees_{organization.organization_code}.csv"}
    )
