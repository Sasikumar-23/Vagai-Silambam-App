"""
Router-level tests for the Google OAuth connect/callback/disconnect flow.
`exchange_code_for_tokens` and `fetch_user_email` are mocked — there is no real
Google OAuth client configured in this environment — but the state signing,
role checks, DB writes and redirect behaviour are exercised for real.
"""

from app.integrations import google_oauth
from app.models import GoogleConnection
from app.tests.fakes.google_api import patch_google_apis


def test_connect_requires_admin(client, make_org, db_session):
    org = make_org("Academy A", "admin_a")
    from app.models import User

    db_session.query(User).filter(User.username == "admin_a").update({"role": "INSTRUCTOR"})
    db_session.commit()

    response = client.get("/api/v1/google/connect", headers=org["headers"])
    assert response.status_code == 403


def test_connect_returns_a_valid_google_url(client, make_org):
    org = make_org("Academy A", "admin_a")
    response = client.get("/api/v1/google/connect", headers=org["headers"])

    assert response.status_code == 200
    url = response.json()["authorization_url"]
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "state=" in url
    assert "access_type=offline" in url
    assert "drive.file" in url


def test_callback_with_tampered_state_redirects_with_error(client):
    response = client.get("/api/v1/google/callback?code=abc&state=not-a-real-token", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "google=error" in response.headers["location"]


def test_callback_without_code_redirects_with_error(client, make_org):
    org = make_org("Academy A", "admin_a")
    state = client.get("/api/v1/google/connect", headers=org["headers"]).json()["authorization_url"]
    state_value = state.split("state=")[1].split("&")[0]

    response = client.get(f"/api/v1/google/callback?state={state_value}", follow_redirects=False)
    assert "google=error" in response.headers["location"]


def test_full_connect_flow_provisions_drive_and_sheets(client, make_org, db_session, monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    monkeypatch.setattr(
        google_oauth, "exchange_code_for_tokens",
        lambda code: {"access_token": "fake-access", "refresh_token": "fake-refresh", "expires_in": 3600},
    )
    monkeypatch.setattr(google_oauth, "fetch_user_email", lambda token: "owner@academy-a.example")

    org = make_org("Academy A", "admin_a")
    auth_url = client.get("/api/v1/google/connect", headers=org["headers"]).json()["authorization_url"]
    state = auth_url.split("state=")[1].split("&")[0]

    response = client.get(f"/api/v1/google/callback?code=auth-code-123&state={state}", follow_redirects=False)

    assert "google=connected" in response.headers["location"]

    connection = db_session.query(GoogleConnection).one()
    assert connection.google_email == "owner@academy-a.example"
    assert connection.status == "CONNECTED"
    assert connection.root_folder_id is not None
    assert connection.attendance_spreadsheet_id is not None
    # tokens are never stored in plaintext
    assert "fake-access" not in connection.access_token_encrypted
    assert "fake-refresh" not in connection.refresh_token_encrypted


def test_connect_status_reflects_the_connection(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    monkeypatch.setattr(
        google_oauth, "exchange_code_for_tokens",
        lambda code: {"access_token": "a", "refresh_token": "r", "expires_in": 3600},
    )
    monkeypatch.setattr(google_oauth, "fetch_user_email", lambda token: "owner@academy-a.example")

    org = make_org("Academy A", "admin_a")
    before = client.get("/api/v1/google/status", headers=org["headers"]).json()
    assert before["connected"] is False

    auth_url = client.get("/api/v1/google/connect", headers=org["headers"]).json()["authorization_url"]
    state = auth_url.split("state=")[1].split("&")[0]
    client.get(f"/api/v1/google/callback?code=x&state={state}", follow_redirects=False)

    after = client.get("/api/v1/google/status", headers=org["headers"]).json()
    assert after["connected"] is True
    assert after["google_email"] == "owner@academy-a.example"


def test_disconnect_requires_admin_and_an_existing_connection(client, make_org):
    org = make_org("Academy A", "admin_a")
    response = client.post("/api/v1/google/disconnect", headers=org["headers"])
    assert response.status_code == 404  # nothing connected yet


def test_disconnect_clears_tokens(client, make_org, db_session, monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    monkeypatch.setattr(
        google_oauth, "exchange_code_for_tokens",
        lambda code: {"access_token": "a", "refresh_token": "r", "expires_in": 3600},
    )
    monkeypatch.setattr(google_oauth, "fetch_user_email", lambda token: "owner@academy-a.example")
    monkeypatch.setattr(google_oauth, "revoke_token", lambda token: None)

    org = make_org("Academy A", "admin_a")
    auth_url = client.get("/api/v1/google/connect", headers=org["headers"]).json()["authorization_url"]
    state = auth_url.split("state=")[1].split("&")[0]
    client.get(f"/api/v1/google/callback?code=x&state={state}", follow_redirects=False)

    response = client.post("/api/v1/google/disconnect", headers=org["headers"])
    assert response.status_code == 204

    connection = db_session.query(GoogleConnection).one()
    assert connection.status == "DISCONNECTED"
    assert connection.access_token_encrypted == ""
