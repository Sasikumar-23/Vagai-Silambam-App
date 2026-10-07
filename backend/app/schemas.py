from datetime import datetime

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
