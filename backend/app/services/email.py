from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import EmailLog

RESEND_URL = "https://api.resend.com/emails"


def enqueue(
    db: Session,
    *,
    organization_id: str | None,
    recipient: str,
    kind: str,
    subject: str,
    body: str,
    reference: str | None = None,
) -> EmailLog:
    log = EmailLog(
        organization_id=organization_id,
        recipient=recipient,
        kind=kind,
        subject=subject,
        body=body,
        reference=reference,
        status="PENDING",
        attempts=0,
    )
    db.add(log)
    db.flush()
    attempt(db, log)
    return log


def attempt(db: Session, log: EmailLog) -> None:
    log.attempts = (log.attempts or 0) + 1
    if not log.recipient:
        log.status = "FAILED"
        log.last_error = "No recipient address on the academy record"
        return

    settings = get_settings()
    if not settings.resend_api_key:
        # Stays PENDING; a retry after RESEND_API_KEY is set will send it.
        log.last_error = "Email provider not configured (RESEND_API_KEY is empty)"
        return

    try:
        response = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [log.recipient],
                "subject": log.subject,
                "text": log.body,
            },
            timeout=10,
        )
    except httpx.HTTPError as exc:
        log.status = "FAILED"
        log.last_error = f"Network error: {type(exc).__name__}"
        return

    if response.status_code in (200, 202):
        log.status = "SENT"
        log.sent_at = datetime.now(timezone.utc)
        log.provider_message_id = (response.json() or {}).get("id")
        log.last_error = None
    else:
        log.status = "FAILED"
        log.last_error = f"Provider returned HTTP {response.status_code}"


def send_cash_receipt(
    db: Session,
    *,
    organization,
    payment,
    plan,
    license_key: str,
    duration_months: int,
    expires_at: datetime,
) -> EmailLog:
    subject = f"Payment received: {plan.name} plan, receipt {payment.payment_reference}"
    body = (
        f"Dear {organization.name},\n\n"
        f"We have received your payment of Rs {payment.amount:,.2f}.\n\n"
        f"Receipt number: {payment.payment_reference}\n"
        f"Plan: {plan.name}\n"
        f"Billing period: {duration_months} month(s)\n"
        f"Access valid until: {expires_at:%d %b %Y}\n"
        f"Academy license ID: {license_key}\n\n"
        "Your team can sign in to the Vagai Silambam app with their username and password.\n\n"
        "Vagai Silambam, DTLP Technologies"
    )
    return enqueue(
        db,
        organization_id=organization.id,
        recipient=organization.email or "",
        kind="CASH_RECEIPT",
        subject=subject,
        body=body,
        reference=payment.payment_reference,
    )
