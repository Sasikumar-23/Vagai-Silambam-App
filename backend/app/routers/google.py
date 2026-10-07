from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .. import errors
from ..auth.deps import get_current_organization, get_current_user, require_role
from ..auth.security import create_oauth_state, decode_token
from ..config import get_settings
from ..database import get_db
from ..integrations import google_drive, google_oauth
from ..integrations.google_sheets import SheetsClient
from ..models import GoogleConnection, Organization, User
from ..schemas import GoogleConnectionOut
from ..services import audit, crypto, google_connection

router = APIRouter(prefix="/api/v1/google", tags=["google"])


@router.get("/connect")
def connect(
    organization: Organization = Depends(get_current_organization),
    user: User = Depends(require_role("ADMIN")),
):
    """
    Returns the Google consent URL for the browser to redirect to. Organization and
    user identity travel in the signed `state` param, not a cookie — the browser
    leaves this site entirely for the consent screen.
    """
    state = create_oauth_state(user.id, organization.id)
    return {"authorization_url": google_oauth.build_authorization_url(state)}


@router.get("/callback")
def callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    """
    Google redirects here after consent. No Authorization header is available —
    everything needed comes from `state`, which this backend signed minutes ago.
    """
    settings = get_settings()

    def redirect(status: str, detail: str = "") -> RedirectResponse:
        query = f"google={status}" + (f"&detail={detail}" if detail else "")
        return RedirectResponse(f"{settings.frontend_url}/settings.html?{query}")

    if error or not code or not state:
        return redirect("error", "denied")

    claims = decode_token(state, "google_oauth_state")
    if not claims:
        return redirect("error", "expired")

    user = db.get(User, claims["sub"])
    organization = db.get(Organization, claims["org"]) if user else None
    if user is None or organization is None or user.organization_id != organization.id:
        return redirect("error", "invalid_session")

    try:
        token_data = google_oauth.exchange_code_for_tokens(code)
        google_email = google_oauth.fetch_user_email(token_data["access_token"])
    except google_oauth.GoogleOAuthError:
        return redirect("error", "token_exchange_failed")

    connection = google_connection.get_connection(db, organization.id)
    if connection is None:
        connection = GoogleConnection(organization_id=organization.id)
        db.add(connection)

    connection.google_email = google_email
    connection.access_token_encrypted = crypto.encrypt_token(token_data["access_token"])
    # Google omits refresh_token on a re-consent within the same session; keep the
    # one already on file rather than overwriting it with nothing.
    if token_data.get("refresh_token"):
        connection.refresh_token_encrypted = crypto.encrypt_token(token_data["refresh_token"])
    connection.token_expiry = google_oauth.expiry_from_now(token_data["expires_in"])
    connection.status = "CONNECTED"
    db.flush()

    try:
        credentials = google_connection.credentials_for(db, connection)
        drive = google_drive.DriveClient(credentials)
        folders = drive.provision_organization_folders(organization.name)
        connection.root_folder_id = folders["root_folder_id"]
        connection.photos_folder_id = folders["photos_folder_id"]
        connection.certificates_folder_id = folders["certificates_folder_id"]
        connection.documents_folder_id = folders["documents_folder_id"]

        sheets = SheetsClient(credentials)
        connection.attendance_spreadsheet_id = sheets.ensure_spreadsheet(
            f"Vagai Silambam Attendance - {organization.name}",
            connection.attendance_sheet_name,
            folder_id=connection.root_folder_id,
        )
    except Exception:
        # The OAuth connection itself succeeded; folder/sheet provisioning can be
        # retried from Settings without forcing the user through consent again.
        db.commit()
        return redirect("connected", "setup_incomplete")

    audit.record(
        db, action="GOOGLE_CONNECTED", organization_id=organization.id, user_id=user.id,
        entity_type="google_connections", entity_id=connection.id, meta={"email": google_email},
    )
    db.commit()
    return redirect("connected")


@router.get("/status", response_model=GoogleConnectionOut)
def status(
    organization: Organization = Depends(get_current_organization),
    db: Session = Depends(get_db),
):
    connection = google_connection.get_connection(db, organization.id)
    if connection is None:
        return GoogleConnectionOut(connected=False)
    return GoogleConnectionOut(
        connected=connection.status == "CONNECTED",
        google_email=connection.google_email,
        attendance_spreadsheet_id=connection.attendance_spreadsheet_id,
        status=connection.status,
    )


@router.post("/disconnect", status_code=204)
def disconnect(
    request: Request,
    organization: Organization = Depends(get_current_organization),
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    connection = google_connection.get_connection(db, organization.id)
    if connection is None:
        raise errors.not_found("No Google connection to disconnect")

    google_oauth.revoke_token(crypto.decrypt_token(connection.refresh_token_encrypted))
    connection.status = "DISCONNECTED"
    connection.access_token_encrypted = ""
    connection.refresh_token_encrypted = ""

    audit.record(
        db, action="GOOGLE_DISCONNECTED", organization_id=organization.id, user_id=user.id,
        entity_type="google_connections", entity_id=connection.id, request=request,
    )
    db.commit()
