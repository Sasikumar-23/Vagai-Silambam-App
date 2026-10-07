"""
Request-scoped security. Every protected route runs through these dependencies:

    authenticated user -> active user -> active organization -> valid subscription -> role

``organization_id`` always comes from the signed token, never from the path, query
string or body.
"""

from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .. import errors
from ..database import get_db, set_tenant_guc
from ..models import Organization, Subscription, User
from ..utils.time import as_utc
from .security import decode_token

# Statuses that may still read and write. SUSPENDED/EXPIRED keep their data but
# the API becomes read-only (see `require_write_access`).
ACTIVE_SUBSCRIPTION_STATUSES = {"TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD"}
READ_ONLY_STATUSES = {"SUSPENDED", "CANCELLED", "EXPIRED"}


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return request.cookies.get("access_token")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _bearer_token(request)
    if not token:
        raise errors.unauthorized()

    payload = decode_token(token, "access")
    if not payload:
        raise errors.unauthorized("Session expired or invalid")

    user = db.get(User, payload["sub"])
    if user is None or not user.is_active:
        raise errors.unauthorized("Account is not active")

    # A token minted before the user moved organization must not keep working.
    if user.organization_id != payload.get("org"):
        raise errors.unauthorized("Session no longer valid")

    if user.organization_id:
        set_tenant_guc(db, user.organization_id)
    return user


def get_current_organization(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Organization:
    if not user.organization_id:
        raise errors.forbidden("NO_ORGANIZATION", "This account is not attached to an organization")

    organization = db.get(Organization, user.organization_id)
    if organization is None:
        raise errors.forbidden("NO_ORGANIZATION", "Organization not found")
    if organization.status != "ACTIVE":
        raise errors.forbidden("ORGANIZATION_SUSPENDED", "This organization has been suspended")
    return organization


def get_subscription(
    organization: Organization = Depends(get_current_organization),
    db: Session = Depends(get_db),
) -> Subscription:
    subscription = (
        db.query(Subscription).filter(Subscription.organization_id == organization.id).one_or_none()
    )
    if subscription is None:
        raise errors.subscription_inactive("NO_SUBSCRIPTION", "No subscription found for this organization")

    # A trial that has run out is expired even if nothing has rewritten the row yet.
    if subscription.status == "TRIAL" and subscription.trial_end:
        if as_utc(subscription.trial_end) < datetime.now(timezone.utc):
            raise errors.subscription_inactive(
                "TRIAL_EXPIRED", "Your free trial has ended. Choose a plan to continue."
            )
    return subscription


def require_active_subscription(subscription: Subscription = Depends(get_subscription)) -> Subscription:
    if subscription.status not in ACTIVE_SUBSCRIPTION_STATUSES:
        raise errors.subscription_inactive(
            "SUBSCRIPTION_INACTIVE",
            "Your subscription is not active. Your data is safe — renew to continue.",
        )
    return subscription


def require_role(*allowed: str) -> Callable[..., User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise errors.forbidden(message="Your role does not allow this action")
        return user

    return dependency


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """Platform staff only. Customer admins must never reach these routes."""
    if user.role != "SUPER_ADMIN" or user.organization_id is not None:
        raise errors.forbidden(message="Platform administrators only")
    return user
