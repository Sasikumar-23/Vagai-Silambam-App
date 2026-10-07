"""
SaaS data model.

Ids are TEXT so that records imported from the existing on-device SQLite app keep
their original identifiers. Every tenant-owned table carries ``organization_id``.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


# ────────────────────────────── platform ──────────────────────────────


class Plan(Base, TimestampMixin):
    """Limits live here, never in application code."""

    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    max_students: Mapped[int] = mapped_column(Integer)
    max_branches: Mapped[int] = mapped_column(Integer)
    max_users: Mapped[int] = mapped_column(Integer)
    price_monthly: Mapped[float] = mapped_column(Float)
    price_annual: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("org"))
    organization_code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    logo_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE|SUSPENDED

    subscription: Mapped[Subscription | None] = relationship(
        back_populates="organization", uselist=False
    )


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("sub"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), unique=True, index=True
    )
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(20), default="TRIAL")
    billing_cycle: Mapped[str] = mapped_column(String(10), default="MONTHLY")
    trial_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subscription_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_billing_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship(back_populates="subscription")
    plan: Mapped[Plan] = relationship()


class License(Base, TimestampMixin):
    __tablename__ = "licenses"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("lic"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), index=True
    )
    license_key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payment(Base, TimestampMixin):
    """Subscription billing. Academy fee collection is the separate `fees` module."""

    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("pay"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"))
    gateway: Mapped[str] = mapped_column(String(20), default="razorpay")
    payment_reference: Mapped[str] = mapped_column(String(120), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    status: Mapped[str] = mapped_column(String(20))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PaymentEvent(Base):
    """Raw webhook events. The unique event id is what makes processing idempotent."""

    __tablename__ = "payment_events"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    gateway: Mapped[str] = mapped_column(String(20), default="razorpay")
    event_type: Mapped[str] = mapped_column(String(80))
    payload: Mapped[str] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ────────────────────────────── tenant ──────────────────────────────


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("organization_id", "username", name="uq_users_org_username"),
        UniqueConstraint("organization_id", "email", name="uq_users_org_email"),
        Index("ix_users_org", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("usr"))
    # NULL for SUPER_ADMIN: platform staff do not belong to a customer organization.
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"))
    username: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(Text)
    full_name_en: Mapped[str] = mapped_column(String(200))
    full_name_ta: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    role: Mapped[str] = mapped_column(String(30), default="INSTRUCTOR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"
    __table_args__ = (Index("ix_branches_org", "organization_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("brn"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str | None] = mapped_column(String(40))
    name_en: Mapped[str] = mapped_column(String(200))
    name_ta: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Student(Base, TimestampMixin):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("organization_id", "student_code", name="uq_students_org_code"),
        Index("ix_students_org_status", "organization_id", "student_status"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("stu"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    branch_id: Mapped[str | None] = mapped_column(ForeignKey("branches.id"))
    student_code: Mapped[str] = mapped_column(String(40))  # VS-2026-0001
    roll_number: Mapped[str | None] = mapped_column(String(40))
    name_en: Mapped[str] = mapped_column(String(200))
    name_ta: Mapped[str | None] = mapped_column(String(200))
    photo_file_id: Mapped[str | None] = mapped_column(String(120))
    date_of_birth: Mapped[str | None] = mapped_column(String(10))
    gender: Mapped[str | None] = mapped_column(String(20))
    contact_number: Mapped[str | None] = mapped_column(String(40))
    address_en: Mapped[str | None] = mapped_column(Text)
    address_ta: Mapped[str | None] = mapped_column(Text)
    joining_date: Mapped[str | None] = mapped_column(String(10))
    training_level: Mapped[str | None] = mapped_column(String(40))
    instructor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    medical_notes: Mapped[str | None] = mapped_column(Text)
    previous_experience: Mapped[str | None] = mapped_column(Text)
    student_status: Mapped[str] = mapped_column(String(20), default="ACTIVE")


class GoogleConnection(Base, TimestampMixin):
    """One Google account per organization. Tokens are encrypted before they get here."""

    __tablename__ = "google_connections"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("gcon"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), unique=True, index=True
    )
    google_email: Mapped[str] = mapped_column(String(200))
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    root_folder_id: Mapped[str | None] = mapped_column(String(120))
    photos_folder_id: Mapped[str | None] = mapped_column(String(120))
    documents_folder_id: Mapped[str | None] = mapped_column(String(120))
    certificates_folder_id: Mapped[str | None] = mapped_column(String(120))
    attendance_spreadsheet_id: Mapped[str | None] = mapped_column(String(120))
    attendance_sheet_name: Mapped[str] = mapped_column(String(120), default="Attendance")
    status: Mapped[str] = mapped_column(String(20), default="CONNECTED")


class DriveFile(Base, TimestampMixin):
    """Metadata only: the bytes stay in the organization's Google Drive."""

    __tablename__ = "drive_files"
    __table_args__ = (Index("ix_drive_files_org", "organization_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("file"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    student_id: Mapped[str | None] = mapped_column(ForeignKey("students.id"))
    drive_file_id: Mapped[str] = mapped_column(String(120))
    file_name: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str | None] = mapped_column(String(120))
    file_type: Mapped[str | None] = mapped_column(String(40))
    folder_id: Mapped[str | None] = mapped_column(String(120))
    uploaded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_org_created", "organization_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("aud"))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str | None] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(60))
    meta: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
