from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, require_active_subscription, require_role
from ..database import get_db
from ..models import Event, EventRegistration, EventResult, Organization, Subscription, User
from ..schemas import (
    EventCreate,
    EventOut,
    EventRegistrationCreate,
    EventRegistrationOut,
    EventResultCreate,
    EventResultOut,
    EventUpdate,
)
from ..services import audit

router = APIRouter(prefix="/api/v1/events", tags=["events"])


def _get_owned_event(db: Session, organization_id: str, event_id: str) -> Event:
    event = (
        db.query(Event)
        .filter(Event.id == event_id, Event.organization_id == organization_id)
        .one_or_none()
    )
    if not event:
        raise errors.not_found("Event not found")
    return event


@router.get("", response_model=list[EventOut])
def list_events(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    query = db.query(Event).filter(Event.organization_id == organization.id)
    if status:
        query = query.filter(Event.status == status)
    return query.order_by(Event.event_date.desc()).limit(limit).all()


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    payload: EventCreate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    event = Event(organization_id=organization.id, **payload.model_dump())
    db.add(event)
    db.flush()

    audit.record(
        db,
        action="EVENT_CREATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="events",
        entity_id=event.id,
        meta={"title": event.title_en},
        request=request,
    )
    db.commit()
    return event


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    return _get_owned_event(db, organization.id, event_id)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    request: Request,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    user: User = Depends(require_role("ADMIN", "INSTRUCTOR")),
    db: Session = Depends(get_db),
):
    event = _get_owned_event(db, organization.id, event_id)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, val)

    audit.record(
        db,
        action="EVENT_UPDATED",
        organization_id=organization.id,
        user_id=user.id,
        entity_type="events",
        entity_id=event.id,
        request=request,
    )
    db.commit()
    return event


# Registrations
@router.get("/{event_id}/registrations", response_model=list[EventRegistrationOut])
def list_registrations(
    event_id: str,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    _get_owned_event(db, organization.id, event_id)
    return (
        db.query(EventRegistration)
        .filter(EventRegistration.organization_id == organization.id, EventRegistration.event_id == event_id)
        .all()
    )


@router.post("/{event_id}/registrations", response_model=EventRegistrationOut, status_code=201)
def register_student_for_event(
    event_id: str,
    payload: EventRegistrationCreate,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    _get_owned_event(db, organization.id, event_id)

    exists = (
        db.query(EventRegistration)
        .filter(
            EventRegistration.organization_id == organization.id,
            EventRegistration.event_id == event_id,
            EventRegistration.student_id == payload.student_id,
        )
        .first()
    )
    if exists:
        raise errors.conflict("ALREADY_REGISTERED", "Student is already registered for this event")

    reg = EventRegistration(
        organization_id=organization.id,
        event_id=event_id,
        student_id=payload.student_id,
        category=payload.category,
        fee_paid=payload.fee_paid,
    )
    db.add(reg)
    db.commit()
    return reg


# Results
@router.post("/{event_id}/results", response_model=EventResultOut, status_code=201)
def record_event_result(
    event_id: str,
    payload: EventResultCreate,
    organization: Organization = Depends(get_current_organization),
    _: Subscription = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    _get_owned_event(db, organization.id, event_id)
    res = EventResult(
        organization_id=organization.id,
        event_id=event_id,
        student_id=payload.student_id,
        position=payload.position,
        medal=payload.medal,
        score=payload.score,
        remarks=payload.remarks,
    )
    db.add(res)
    db.commit()
    return res
