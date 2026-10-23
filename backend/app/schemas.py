from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    organization_name: str = Field(min_length=2, max_length=200)
    full_name_en: str = Field(min_length=2, max_length=200)
    email: EmailStr
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    password: str = Field(min_length=8, max_length=200)
    phone: str | None = Field(default=None, max_length=40)


class LoginRequest(BaseModel):
    username: str
    password: str


# Roles an academy admin can give a member. ADMIN is the owner's role and is never assigned here.
MemberRole = Literal["INSTRUCTOR", "STAFF", "STAFF_ACCOUNTANT"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    full_name_en: str = Field(min_length=2, max_length=200)
    full_name_ta: str | None = Field(default=None, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    role: MemberRole = "INSTRUCTOR"


class UserRoleUpdate(BaseModel):
    role: MemberRole


class PlanCreate(BaseModel):
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z_]+$")
    name: str = Field(min_length=1, max_length=120)
    max_students: int = Field(ge=-1)  # -1 = unlimited
    max_branches: int = Field(ge=-1)
    max_users: int = Field(ge=-1)
    price_monthly: float = Field(ge=0)
    price_annual: float = Field(ge=0)
    sort_order: int = 0
    is_active: bool = True


class PlanUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    max_students: int = Field(ge=-1)
    max_branches: int = Field(ge=-1)
    max_users: int = Field(ge=-1)
    price_monthly: float = Field(ge=0)
    price_annual: float = Field(ge=0)
    sort_order: int = 0
    is_active: bool = True


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)


class UserLicenseOut(BaseModel):
    id: str
    username: str
    full_name_en: str
    role: str
    is_active: bool
    license_status: str | None


class UserCreatedOut(BaseModel):
    user: UserLicenseOut
    license_key: str  # shown once; only the admin sees it


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str | None
    username: str
    email: str
    full_name_en: str
    full_name_ta: str | None
    role: str
    is_active: bool


class SessionResponse(TokenResponse):
    """Login and register also return the signed-in user, so clients need no second call."""

    organization_id: str | None
    user: UserOut


class StudentCreate(BaseModel):
    # organization_id is deliberately absent: it is taken from the access token.
    student_code: str = Field(min_length=1, max_length=40)
    name_en: str = Field(min_length=1, max_length=200)
    name_ta: str | None = Field(default=None, max_length=200)
    roll_number: str | None = Field(default=None, max_length=40)
    date_of_birth: str | None = Field(default=None, max_length=10)
    gender: str | None = Field(default=None, max_length=20)
    contact_number: str | None = Field(default=None, max_length=40)
    address_en: str | None = None
    address_ta: str | None = None
    joining_date: str | None = Field(default=None, max_length=10)
    training_level: str | None = Field(default=None, max_length=40)
    branch_id: str | None = None
    medical_notes: str | None = None
    previous_experience: str | None = None


class StudentUpdate(BaseModel):
    name_en: str | None = Field(default=None, max_length=200)
    name_ta: str | None = Field(default=None, max_length=200)
    roll_number: str | None = Field(default=None, max_length=40)
    contact_number: str | None = Field(default=None, max_length=40)
    training_level: str | None = Field(default=None, max_length=40)
    student_status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")
    medical_notes: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_code: str
    name_en: str
    name_ta: str | None
    roll_number: str | None
    contact_number: str | None
    training_level: str | None
    student_status: str
    created_at: datetime


class PageMeta(BaseModel):
    total: int
    limit: int
    offset: int


class StudentPage(BaseModel):
    items: list[StudentOut]
    meta: PageMeta


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    max_students: int
    max_branches: int
    max_users: int
    price_monthly: float
    price_annual: float


class GoogleConnectRequest(BaseModel):
    pass


class GoogleConnectionOut(BaseModel):
    connected: bool
    google_email: str | None = None
    attendance_spreadsheet_id: str | None = None
    status: str | None = None


class AttendanceMarkRequest(BaseModel):
    student_id: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    session_name: str = Field(default="Daily Training", max_length=120)
    status: str = Field(pattern="^(Present|Absent|Late|Leave)$")
    remarks: str | None = Field(default=None, max_length=500)


class AttendanceMarkResponse(BaseModel):
    attendance_id: str
    student_id: str
    date: str
    status: str


class AttendanceRecord(BaseModel):
    attendance_id: str
    date: str
    student_id: str
    student_name: str
    session_name: str
    status: str
    remarks: str
    marked_by: str
    created_at: str


class StudentAttendanceSummary(BaseModel):
    records: list[AttendanceRecord]
    total_sessions: int
    present: int
    percentage: float


class SubscriptionOut(BaseModel):
    organization_name: str
    organization_code: str
    plan: PlanOut
    status: str
    billing_cycle: str
    trial_end: datetime | None
    next_billing_date: datetime | None
    expires_at: datetime | None
    license_key: str | None
    usage: dict[str, int]
    limits: dict[str, int]


# ── Academy Modules Schemas ──

class StudentImportResult(BaseModel):
    total_rows: int
    imported_count: int
    skipped_count: int
    errors: list[dict[str, str | int]]


class EventCreate(BaseModel):
    title_en: str = Field(min_length=1, max_length=200)
    title_ta: str | None = Field(default=None, max_length=200)
    event_type: str = Field(default="COMPETITION", max_length=40)
    event_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    venue: str | None = Field(default=None, max_length=250)
    description: str | None = None
    registration_fee: float = Field(default=0.0, ge=0.0)


class EventUpdate(BaseModel):
    title_en: str | None = None
    title_ta: str | None = None
    event_type: str | None = None
    event_date: str | None = None
    venue: str | None = None
    description: str | None = None
    registration_fee: float | None = None
    status: str | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    title_en: str
    title_ta: str | None
    event_type: str
    event_date: str
    venue: str | None
    description: str | None
    registration_fee: float
    status: str
    created_at: datetime


class EventRegistrationCreate(BaseModel):
    student_id: str
    category: str | None = None
    fee_paid: bool = False


class EventRegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    student_id: str
    category: str | None
    fee_paid: bool
    status: str
    created_at: datetime


class EventResultCreate(BaseModel):
    student_id: str
    position: str | None = None
    medal: str | None = None
    score: str | None = None
    remarks: str | None = None


class EventResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    student_id: str
    position: str | None
    medal: str | None
    score: str | None
    remarks: str | None


class FeeCreate(BaseModel):
    student_id: str
    fee_type: str = Field(default="MONTHLY_TUITION", max_length=60)
    title_en: str = Field(min_length=1, max_length=150)
    title_ta: str | None = Field(default=None, max_length=150)
    amount: float = Field(gt=0.0)
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    notes: str | None = None


class FeePayRequest(BaseModel):
    payment_mode: str = Field(default="UPI", pattern="^(CASH|UPI|BANK_TRANSFER|CARD)$")
    receipt_number: str | None = None
    paid_date: str | None = None
    notes: str | None = None


class FeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    fee_type: str
    title_en: str
    title_ta: str | None
    amount: float
    due_date: str | None
    paid_date: str | None
    receipt_number: str | None
    payment_mode: str | None
    status: str
    notes: str | None
    created_at: datetime


class UniformCreate(BaseModel):
    student_id: str
    uniform_type: str = Field(default="STANDARD_SUIT", max_length=60)
    size: str = Field(min_length=1, max_length=20)
    price: float = Field(default=0.0, ge=0.0)
    order_date: str | None = None
    notes: str | None = None


class UniformUpdate(BaseModel):
    size: str | None = None
    price: float | None = None
    is_paid: bool | None = None
    status: str | None = None
    delivery_date: str | None = None
    notes: str | None = None


class UniformOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    uniform_type: str
    size: str
    price: float
    is_paid: bool
    status: str
    order_date: str | None
    delivery_date: str | None
    notes: str | None
    created_at: datetime


class AchievementCreate(BaseModel):
    student_id: str
    title_en: str = Field(min_length=1, max_length=200)
    title_ta: str | None = Field(default=None, max_length=200)
    achievement_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    level: str | None = None
    medal_or_rank: str | None = None
    description: str | None = None


class AchievementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    title_en: str
    title_ta: str | None
    achievement_date: str
    level: str | None
    medal_or_rank: str | None
    description: str | None
    created_at: datetime


class CertificateCreate(BaseModel):
    student_id: str
    certificate_number: str = Field(min_length=1, max_length=60)
    title_en: str = Field(min_length=1, max_length=200)
    title_ta: str | None = Field(default=None, max_length=200)
    issue_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    certificate_type: str = Field(default="COURSE_COMPLETION", max_length=40)
    verification_code: str | None = None
    notes: str | None = None


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    certificate_number: str
    title_en: str
    title_ta: str | None
    issue_date: str
    certificate_type: str
    verification_code: str | None
    drive_file_id: str | None
    created_at: datetime

