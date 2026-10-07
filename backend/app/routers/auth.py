from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_user
from ..auth.security import (
    create_access_token, create_refresh_token, decode_token, hash_password,
    needs_rehash, verify_password,
)
from ..database import get_db
from ..models import Organization, User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from ..services import audit, provisioning

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Public signup: creates the organization, its admin, a 14-day trial and a license."""
    email = payload.email.lower()
    username = payload.username.lower()

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise errors.conflict("EMAIL_TAKEN", "An account with this email already exists")

    organization = Organization(
        organization_code=provisioning.next_organization_code(db),
        name=payload.organization_name.strip(),
        email=email,
        phone=payload.phone,
    )
    db.add(organization)
    db.flush()

    user = User(
        organization_id=organization.id,
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        full_name_en=payload.full_name_en.strip(),
        phone=payload.phone,
        role="ADMIN",  # the signup owner administers their own organization
    )
    db.add(user)

    provisioning.start_trial(db, organization)
    audit.record(
        db,
        action="ORGANIZATION_REGISTERED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="organizations",
        entity_id=organization.id,
        meta={"organization": organization.name},
        request=request,
    )
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.organization_id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    identifier = payload.username.strip().lower()
    user = (
        db.query(User)
        .filter((func.lower(User.username) == identifier) | (func.lower(User.email) == identifier))
        .first()
    )

    # Same message either way so the endpoint cannot be used to enumerate accounts.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise errors.unauthorized("Invalid username or password")
    if not user.is_active:
        raise errors.forbidden("ACCOUNT_DISABLED", "This account has been disabled")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    user.last_login_at = datetime.now(timezone.utc)
    audit.record(
        db,
        action="LOGIN",
        organization_id=user.organization_id,
        user_id=user.id,
        request=request,
    )
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.organization_id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: dict, db: Session = Depends(get_db)):
    token = payload.get("refresh_token", "")
    claims = decode_token(token, "refresh")
    if not claims:
        raise errors.unauthorized("Refresh token is invalid or expired")

    user = db.get(User, claims["sub"])
    if user is None or not user.is_active:
        raise errors.unauthorized("Account is not active")

    return TokenResponse(
        access_token=create_access_token(user.id, user.organization_id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    audit.record(
        db, action="LOGOUT", organization_id=user.organization_id, user_id=user.id, request=request
    )
    db.commit()
