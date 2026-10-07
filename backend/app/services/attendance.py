from sqlalchemy.orm import Session

from .. import errors
from ..integrations.google_sheets import SheetsClient
from ..models import GoogleConnection, Organization, Student
from . import google_connection

STATUSES = {"Present", "Absent", "Late", "Leave"}


def _sheets_client(db: Session, connection: GoogleConnection) -> SheetsClient:
    credentials = google_connection.credentials_for(db, connection)
    return SheetsClient(credentials)


def _owned_student(db: Session, organization_id: str, student_id: str) -> Student:
    student = (
        db.query(Student)
        .filter(Student.id == student_id, Student.organization_id == organization_id)
        .one_or_none()
    )
    if student is None:
        raise errors.not_found("Student not found")
    return student


def mark_attendance(
    db: Session,
    organization: Organization,
    *,
    student_id: str,
    date: str,
    session_name: str,
    status: str,
    remarks: str | None,
    marked_by: str,
) -> dict:
    if status not in STATUSES:
        raise errors.bad_request("INVALID_STATUS", f"Status must be one of {sorted(STATUSES)}")

    student = _owned_student(db, organization.id, student_id)
    connection = google_connection.require_connection(db, organization.id)
    if not connection.attendance_spreadsheet_id:
        raise errors.bad_request(
            "ATTENDANCE_SHEET_NOT_CONFIGURED", "No attendance spreadsheet is configured yet"
        )

    client = _sheets_client(db, connection)
    attendance_id = client.mark_attendance(
        connection.attendance_spreadsheet_id,
        connection.attendance_sheet_name,
        organization_id=organization.id,
        date=date,
        student_id=student.id,
        student_name=student.name_en,
        session_name=session_name,
        status=status,
        remarks=remarks or "",
        marked_by=marked_by,
    )
    return {"attendance_id": attendance_id, "student_id": student.id, "date": date, "status": status}


def _read_rows(db: Session, organization: Organization) -> list[dict]:
    connection = google_connection.require_connection(db, organization.id)
    if not connection.attendance_spreadsheet_id:
        return []
    client = _sheets_client(db, connection)
    rows = client.read_all_rows(connection.attendance_spreadsheet_id, connection.attendance_sheet_name)
    # Tenant isolation inside the shared Sheets column, not just the folder it lives in:
    # a row written by a bug or a stale organization_id must never be shown to this org.
    return [row for row in rows if row.get("organization_id") == organization.id]


def attendance_for_date(db: Session, organization: Organization, date: str) -> list[dict]:
    return [row for row in _read_rows(db, organization) if row["date"] == date]


def attendance_for_student(db: Session, organization: Organization, student_id: str) -> dict:
    _owned_student(db, organization.id, student_id)  # 404s if the student isn't this org's
    records = [row for row in _read_rows(db, organization) if row["student_id"] == student_id]

    total = len(records)
    present = sum(1 for row in records if row["status"] == "Present")
    percentage = round((present / total) * 100, 1) if total else 0.0

    return {"records": records, "total_sessions": total, "present": present, "percentage": percentage}
