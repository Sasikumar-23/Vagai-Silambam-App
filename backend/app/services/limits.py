from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import errors
from ..models import Branch, Plan, Student, Subscription, User


def _plan_for(db: Session, subscription: Subscription) -> Plan:
    plan = db.get(Plan, subscription.plan_id)
    if plan is None:
        raise errors.subscription_inactive("NO_PLAN", "Subscription plan not found")
    return plan


def usage_for(db: Session, organization_id: str) -> dict[str, int]:
    def count(model, *filters) -> int:
        return db.query(func.count(model.id)).filter(*filters).scalar() or 0

    return {
        "students": count(
            Student, Student.organization_id == organization_id, Student.student_status == "ACTIVE"
        ),
        "branches": count(Branch, Branch.organization_id == organization_id, Branch.is_active.is_(True)),
        "users": count(User, User.organization_id == organization_id, User.is_active.is_(True)),
    }


def limits_for(db: Session, subscription: Subscription) -> dict[str, int]:
    plan = _plan_for(db, subscription)
    return {
        "students": plan.max_students,
        "branches": plan.max_branches,
        "users": plan.max_users,
    }


def enforce_limit(db: Session, subscription: Subscription, organization_id: str, resource: str) -> None:
    """
    Raise PLAN_LIMIT_REACHED if adding one more row would exceed the plan.
    Limits come from the plans table; nothing here is hardcoded.
    """
    limit = limits_for(db, subscription)[resource]
    if limit < 0:  # negative means unlimited (ENTERPRISE)
        return

    current = usage_for(db, organization_id)[resource]
    if current >= limit:
        label = {"students": "student", "branches": "branch", "users": "user"}[resource]
        raise errors.plan_limit_reached(
            f"You have reached the {label} limit ({limit}) for your current plan. "
            "Please upgrade your subscription."
        )
