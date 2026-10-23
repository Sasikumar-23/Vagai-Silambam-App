import logging

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ..auth.security import decode_token
from ..database import get_db
from ..models import ApiRequestLog

logger = logging.getLogger("vagai.requests")


def log_api_request(request: Request, db: Session = Depends(get_db)) -> None:
    path = request.url.path
    if not path.startswith("/api/v1/"):
        return

    user_id = None
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        claims = decode_token(header[7:].strip(), "access")
        if claims:
            user_id = claims.get("sub")

    try:
        db.add(
            ApiRequestLog(
                user_id=user_id,
                method=request.method,
                path=path[:300],
                ip_address=request.client.host if request.client else None,
            )
        )
        db.commit()
    except Exception:  # logging must never break the request it describes
        db.rollback()
        logger.exception("could not write API request log")
