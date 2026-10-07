"""Plan catalogue. Limits live in the database so they can change without a deploy."""

from sqlalchemy.orm import Session

from .models import Plan

PLANS = [
    # code, name, students, branches, users, monthly, annual, sort
    ("STARTER", "Starter", 50, 1, 5, 499.0, 4999.0, 1),
    ("STANDARD", "Standard", 150, 1, 10, 999.0, 9999.0, 2),
    ("PROFESSIONAL", "Professional", 300, 2, 20, 1499.0, 14999.0, 3),
    ("BUSINESS", "Business", 500, 5, 50, 2499.0, 24999.0, 4),
    # -1 means unlimited; pricing is agreed per customer.
    ("ENTERPRISE", "Enterprise", -1, -1, -1, 0.0, 0.0, 5),
]


def seed_plans(db: Session) -> None:
    for code, name, students, branches, users, monthly, annual, order in PLANS:
        plan = db.query(Plan).filter(Plan.code == code).one_or_none()
        if plan is None:
            db.add(
                Plan(
                    id=f"plan_{code.lower()}",
                    code=code,
                    name=name,
                    max_students=students,
                    max_branches=branches,
                    max_users=users,
                    price_monthly=monthly,
                    price_annual=annual,
                    sort_order=order,
                )
            )
    db.commit()
