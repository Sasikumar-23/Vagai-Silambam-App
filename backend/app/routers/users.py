from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..auth.security import hash_password
from ..database import get_db
from ..models import License, Organization, Subscription, User
from ..schemas import ResetPasswordRequest, UserCreate, UserCreatedOut, UserLicenseOut
from ..services import audit, limits, provisioning
from ..services.provisioning import ADMIN_ROLES

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _license_status(db: Session, user_id: str) -> str | None:
    if provisioning.has_active_user_license(db, user_id):
        return "ACTIVE"
    latest = (
        db.query(License.status)
        .filter(License.user_id == user_id)
        .order_by(License.created_at.desc())
        .first()
    )
    return latest[0] if latest else None


def _license_statuses(db: Session, users: list[User]) -> dict[str, str]:
    """Status for many users in two queries: active licenses first, then the latest row for the rest."""
    user_ids = [u.id for u in users]
    statuses = {user_id: "ACTIVE" for user_id in provisioning.users_with_active_license(db, user_ids)}
    pending = [user_id for user_id in user_ids if user_id not in statuses]
    if pending:
        # Newest first, so the first row seen for each user is its latest license.
        rows = (
            db.query(License.user_id, License.status)
            .filter(License.user_id.in_(pending))
            .order_by(License.created_at.desc())
            .all()
        )
        for user_id, status in rows:
            statuses.setdefault(user_id, status)
    return statuses


def _to_out(user: User, license_status: str | None) -> UserLicenseOut:
    return UserLicenseOut(
        id=user.id,
        username=user.username,
        full_name_en=user.full_name_en,
        role=user.role,
        is_active=user.is_active,
        license_status=license_status,
    )


def _member_in_org(db: Session, organization_id: str, user_id: str) -> User:
    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == organization_id)
        .one_or_none()
    )
    if user is None:
        raise errors.not_found("User not found in your academy")
    return user


@router.get("", response_model=list[UserLicenseOut])
def list_users(
    organization: Organization = Depends(get_current_organization),
    admin: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.organization_id == organization.id)
        .order_by(User.created_at)
        .all()
    )
    statuses = _license_statuses(db, users)
    return [_to_out(user, statuses.get(user.id)) for user in users]


@router.post("", response_model=UserCreatedOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    subscription: Subscription = Depends(require_active_subscription),
    admin: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    limits.enforce_limit(db, subscription, organization.id, "users")

    username = payload.username.lower()
    taken = (
        db.query(User)
        .filter(User.organization_id == organization.id, func.lower(User.username) == username)
        .first()
    )
    if taken:
        raise errors.conflict("USERNAME_TAKEN", "That username is already used in your academy")

    user = User(
        organization_id=organization.id,
        username=username,
        # Login is by username; email is a unique placeholder because the column is required.
        email=f"{username}@{organization.organization_code.lower()}.local",
        password_hash=hash_password(payload.password),
        full_name_en=payload.full_name_en.strip(),
        full_name_ta=(payload.full_name_ta or "").strip() or None,
        role="INSTRUCTOR",
    )
    db.add(user)
    db.flush()

    license_row = provisioning.issue_user_license(db, organization.id, user.id)
    audit.record(
        db,
        action="USER_CREATED",
        organization_id=organization.id,
        user_id=admin.id,
        entity_type="users",
        entity_id=user.id,
        meta={"username": username},
        request=request,
    )
    db.commit()

    return UserCreatedOut(user=_to_out(user, "ACTIVE"), license_key=license_row.license_key)


@router.post("/{user_id}/license/revoke", response_model=UserLicenseOut)
def revoke_license(
    user_id: str,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    admin: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise errors.bad_request("CANNOT_REVOKE_OWN_LICENSE", "You cannot revoke your own license")

    target = _member_in_org(db, organization.id, user_id)
    if target.role in ADMIN_ROLES:
        raise errors.bad_request("ADMIN_ACCOUNT_NOT_LICENSED", "Academy admin accounts do not use seat licenses")
    db.query(License).filter(License.user_id == target.id, License.status == "ACTIVE").update(
        {"status": "REVOKED"}, synchronize_session=False
    )
    audit.record(
        db,
        action="LICENSE_REVOKED",
        organization_id=organization.id,
        user_id=admin.id,
        entity_type="users",
        entity_id=target.id,
        meta={"username": target.username},
        request=request,
    )
    db.commit()
    return _to_out(target, _license_status(db, target.id))


@router.post("/{user_id}/license/reissue", response_model=UserCreatedOut)
def reissue_license(
    user_id: str,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    subscription: Subscription = Depends(require_active_subscription),
    admin: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    target = _member_in_org(db, organization.id, user_id)
    if target.role in ADMIN_ROLES:
        raise errors.bad_request("ADMIN_ACCOUNT_NOT_LICENSED", "Academy admin accounts do not use seat licenses")
    db.query(License).filter(License.user_id == target.id, License.status == "ACTIVE").update(
        {"status": "REVOKED"}, synchronize_session=False
    )
    license_row = provisioning.issue_user_license(db, organization.id, target.id)
    audit.record(
        db,
        action="LICENSE_REISSUED",
        organization_id=organization.id,
        user_id=admin.id,
        entity_type="users",
        entity_id=target.id,
        meta={"username": target.username},
        request=request,
    )
    db.commit()
    return UserCreatedOut(user=_to_out(target, "ACTIVE"), license_key=license_row.license_key)


@router.post("/{user_id}/reset-password", status_code=204)
def reset_member_password(
    user_id: str,
    payload: ResetPasswordRequest,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    admin: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    target = _member_in_org(db, organization.id, user_id)
    target.password_hash = hash_password(payload.new_password)
    audit.record(
        db,
        action="PASSWORD_RESET_BY_ADMIN",
        organization_id=organization.id,
        user_id=admin.id,
        entity_type="users",
        entity_id=target.id,
        meta={"username": target.username},
        request=request,
    )
    db.commit()
