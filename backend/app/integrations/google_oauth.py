"""
OAuth is only used to connect Google Drive and Google Sheets for the organization's
own account — it is never the application login. The token exchange is done with
plain HTTP calls (not google-auth-oauthlib's Flow) so it is easy to unit test by
mocking `httpx`.
"""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from ..config import get_settings

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"

# drive.file (not full Drive access) and spreadsheets are enough for this product.
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
]


class GoogleOAuthError(Exception):
    pass


def build_authorization_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",  # required to receive a refresh_token
        "prompt": "consent",  # forces a refresh_token on every connect, not only the first
        "state": state,
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    settings = get_settings()
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if response.status_code != 200:
        raise GoogleOAuthError(f"Token exchange failed: {response.text}")
    return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    settings = get_settings()
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    if response.status_code != 200:
        raise GoogleOAuthError(f"Token refresh failed: {response.text}")
    return response.json()


def fetch_user_email(access_token: str) -> str:
    response = httpx.get(
        USERINFO_ENDPOINT, headers={"Authorization": f"Bearer {access_token}"}, timeout=15
    )
    if response.status_code != 200:
        raise GoogleOAuthError(f"Could not fetch Google profile: {response.text}")
    return response.json()["email"]


def revoke_token(token: str) -> None:
    # Best-effort: disconnecting must succeed locally even if Google's revoke call fails.
    try:
        httpx.post(REVOKE_ENDPOINT, params={"token": token}, timeout=10)
    except httpx.HTTPError:
        pass


def expiry_from_now(expires_in_seconds: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
