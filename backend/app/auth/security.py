from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from ..config import get_settings

# argon2id with library defaults; the mobile app's salted SHA-256 is not good
# enough for credentials that now live on a server.
_hasher = PasswordHasher()

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def _create_token(subject: str, token_type: str, expires: timedelta, **claims: Any) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(user_id: str, organization_id: str | None, role: str) -> str:
    settings = get_settings()
    # organization_id is carried in the signed token and never read from the request.
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.jwt_access_minutes),
        org=organization_id,
        role=role,
    )


def create_refresh_token(user_id: str) -> str:
    settings = get_settings()
    return _create_token(user_id, "refresh", timedelta(days=settings.jwt_refresh_days))


def decode_token(token: str, expected_type: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload
