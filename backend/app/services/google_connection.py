from datetime import datetime, timedelta, timezone

from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session

from .. import errors
from ..config import get_settings
from ..integrations import google_oauth
from ..models import GoogleConnection
from ..utils.time import as_utc
from . import crypto

# Refresh a little before the token actually expires so a request never races it.
REFRESH_MARGIN = timedelta(minutes=5)


class GoogleNotConnected(Exception):
    pass


def get_connection(db: Session, organization_id: str) -> GoogleConnection | None:
    return db.query(GoogleConnection).filter(GoogleConnection.organization_id == organization_id).one_or_none()


def require_connection(db: Session, organization_id: str) -> GoogleConnection:
    connection = get_connection(db, organization_id)
    if connection is None or connection.status != "CONNECTED":
        raise errors.bad_request(
            "GOOGLE_NOT_CONNECTED",
            "Connect your Google account in Settings before using Drive or Sheets features.",
        )
    return connection


def credentials_for(db: Session, connection: GoogleConnection) -> Credentials:
    """
    Returns live Credentials, refreshing and persisting a new access token first
    if the stored one is at or near expiry. The refresh token itself is long-lived
    and is never sent anywhere except back to Google.
    """
    settings = get_settings()
    access_token = crypto.decrypt_token(connection.access_token_encrypted)
    refresh_token = crypto.decrypt_token(connection.refresh_token_encrypted)

    expiry = as_utc(connection.token_expiry)
    if expiry is None or expiry - REFRESH_MARGIN <= datetime.now(timezone.utc):
        token_data = google_oauth.refresh_access_token(refresh_token)
        access_token = token_data["access_token"]
        connection.access_token_encrypted = crypto.encrypt_token(access_token)
        connection.token_expiry = google_oauth.expiry_from_now(token_data["expires_in"])
        db.commit()

    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=google_oauth.TOKEN_ENDPOINT,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=google_oauth.SCOPES,
    )
