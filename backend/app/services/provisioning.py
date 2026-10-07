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
