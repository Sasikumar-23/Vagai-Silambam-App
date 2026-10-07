import json

from fastapi import Request
from sqlalchemy.orm import Session

from ..models import AuditLog

# Never write credentials or tokens into the audit trail.
_REDACTED_KEYS = {"password", "password_hash", "access_token", "refresh_token", "secret", "token"}


def _safe_meta(meta: dict | None) -> str | None:
    if not meta:
        return None
    cleaned = {k: ("[redacted]" if k.lower() in _REDACTED_KEYS else v) for k, v in meta.items()}
    return json.dumps(cleaned, ensure_ascii=False, default=str)


def record(
    db: Session,
    *,
    action: str,
    organization_id: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    meta: dict | None = None,
    request: Request | None = None,
) -> None:
    db.add(
        AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=_safe_meta(meta),
            ip_address=request.client.host if request and request.client else None,
        )
    )
