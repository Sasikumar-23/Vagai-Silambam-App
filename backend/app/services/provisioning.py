import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import License, Organization, Plan, Subscription

_KEY_ALPHABET = string.ascii_uppercase + string.digits


def generate_license_key() -> str:
    """VS-XXXX-XXXX-XXXX from a CSPRNG. Never sequential or guessable."""
    groups = ["".join(secrets.choice(_KEY_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "VS-" + "-".join(groups)


def next_organization_code(db: Session) -> str:
    count = db.query(func.count(Organization.id)).scalar() or 0
    return f"VS-ORG-{count + 1:05d}"


def default_plan(db: Session) -> Plan:
    plan = db.query(Plan).filter(Plan.code == "STARTER").one_or_none()
    if plan is None:
        plan = db.query(Plan).order_by(Plan.sort_order).first()
    if plan is None:
        raise RuntimeError("No subscription plans configured — run the plan seed")
    return plan


def issue_user_license(db: Session, organization_id: str, user_id: str) -> License:
    license_row = License(
        organization_id=organization_id,
        user_id=user_id,
        license_key=generate_license_key(),
        status="ACTIVE",
    )
    db.add(license_row)
    return license_row


ADMIN_ROLES = {"ADMIN", "SUPER_ADMIN"}


def requires_seat_license(user) -> bool:
    """Academy admins run the subscription; only seat users need their own license."""
    return bool(user.organization_id) and user.role not in ADMIN_ROLES


def has_active_user_license(db: Session, user_id: str) -> bool:
    return (
        db.query(License.id)
        .filter(License.user_id == user_id, License.status == "ACTIVE")
        .first()
        is not None
    )


def users_with_active_license(db: Session, user_ids: list[str]) -> set[str]:
    """One query for many users; use instead of calling has_active_user_license in a loop."""
    if not user_ids:
        return set()
    rows = (
        db.query(License.user_id)
        .filter(License.user_id.in_(user_ids), License.status == "ACTIVE")
        .distinct()
        .all()
    )
    return {user_id for (user_id,) in rows}


def start_trial(db: Session, organization: Organization, plan: Plan | None = None) -> Subscription:
    settings = get_settings()
    plan = plan or default_plan(db)
    now = datetime.now(timezone.utc)

    subscription = Subscription(
        organization_id=organization.id,
        plan_id=plan.id,
        status="TRIAL",
        billing_cycle="MONTHLY",
        trial_start=now,
        trial_end=now + timedelta(days=settings.trial_days),
    )
    db.add(subscription)

    db.add(
        License(
            organization_id=organization.id,
            license_key=generate_license_key(),
            status="ACTIVE",
            expires_at=subscription.trial_end,
        )
    )
    return subscription
