from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.deps import get_current_organization, get_subscription
from ..database import get_db
from ..models import License, Organization, Plan, Subscription
from ..schemas import PlanOut, SubscriptionOut
from ..services import limits

router = APIRouter(prefix="/api/v1", tags=["subscription"])


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).filter(Plan.is_active.is_(True)).order_by(Plan.sort_order).all()


@router.get("/subscription", response_model=SubscriptionOut)
def my_subscription(
    organization: Organization = Depends(get_current_organization),
    subscription: Subscription = Depends(get_subscription),
    db: Session = Depends(get_db),
):
    plan = db.get(Plan, subscription.plan_id)
    license_row = (
        db.query(License)
        .filter(License.organization_id == organization.id, License.status == "ACTIVE")
        .first()
    )

    return SubscriptionOut(
        organization_name=organization.name,
        organization_code=organization.organization_code,
        plan=PlanOut.model_validate(plan),
        status=subscription.status,
        billing_cycle=subscription.billing_cycle,
        trial_end=subscription.trial_end,
        next_billing_date=subscription.next_billing_date,
        expires_at=subscription.expires_at,
        license_key=license_row.license_key if license_row else None,
        usage=limits.usage_for(db, organization.id),
        limits=limits.limits_for(db, subscription),
    )
