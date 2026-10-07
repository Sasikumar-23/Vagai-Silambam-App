"""
Attendance is the one dataset that lives in Google Sheets, not PostgreSQL, so its
tenant isolation has to be enforced in application code (filtering rows by
organization_id) rather than by a database WHERE clause. These tests specifically
target that: two organizations share the SAME fake spreadsheet "world", exactly
the scenario a real implementation bug could leak across.
"""

from app.integrations import google_oauth
from app.models import User
from app.tests.fakes.google_api import patch_google_apis


def _connect_google(client, org, monkeypatch, drive_world, sheets_store, email="owner@example.com"):
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    monkeypatch.setattr(
        google_oauth, "exchange_code_for_tokens",
        lambda code: {"access_token": "a", "refresh_token": "r", "expires_in": 3600},
    )
    monkeypatch.setattr(google_oauth, "fetch_user_email", lambda token: email)

    auth_url = client.get("/api/v1/google/connect", headers=org["headers"]).json()["authorization_url"]
    state = auth_url.split("state=")[1].split("&")[0]
    client.get(f"/api/v1/google/callback?code=x&state={state}", follow_redirects=False)


def _add_student(client, headers, code="VS-0001"):
    response = client.post("/api/v1/students", headers=headers, json={"student_code": code, "name_en": "Student"})
    assert response.status_code == 201
    return response.json()["id"]


def test_mark_attendance_requires_google_connection(client, make_org):
    org = make_org("Academy A", "admin_a")
    student_id = _add_student(client, org["headers"])

    response = client.post(
        "/api/v1/attendance", headers=org["headers"],
        json={"student_id": student_id, "date": "2026-10-07", "status": "Present"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "GOOGLE_NOT_CONNECTED"


def test_mark_and_read_back_attendance(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org = make_org("Academy A", "admin_a")
    _connect_google(client, org, monkeypatch, drive_world, sheets_store)
    student_id = _add_student(client, org["headers"])

    mark = client.post(
        "/api/v1/attendance", headers=org["headers"],
        json={"student_id": student_id, "date": "2026-10-07", "status": "Present", "session_name": "Morning"},
    )
    assert mark.status_code == 200
    assert mark.json()["status"] == "Present"

    by_date = client.get("/api/v1/attendance/date/2026-10-07", headers=org["headers"]).json()
    assert len(by_date["records"]) == 1
    assert by_date["records"][0]["student_id"] == student_id

    summary = client.get(f"/api/v1/attendance/student/{student_id}", headers=org["headers"]).json()
    assert summary["total_sessions"] == 1
    assert summary["present"] == 1
    assert summary["percentage"] == 100.0


def test_marking_twice_updates_in_place_through_the_api(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org = make_org("Academy A", "admin_a")
    _connect_google(client, org, monkeypatch, drive_world, sheets_store)
    student_id = _add_student(client, org["headers"])

    for status in ("Absent", "Present"):
        client.post(
            "/api/v1/attendance", headers=org["headers"],
            json={"student_id": student_id, "date": "2026-10-07", "status": status, "session_name": "Morning"},
        )

    by_date = client.get("/api/v1/attendance/date/2026-10-07", headers=org["headers"]).json()
    assert len(by_date["records"]) == 1
    assert by_date["records"][0]["status"] == "Present"


def test_organization_b_never_sees_organization_a_attendance(client, make_org, monkeypatch):
    """
    Both organizations' spreadsheets live in the SAME fake world/store here —
    this is deliberately the adversarial case: if the organization_id filter in
    services/attendance.py were ever removed, this test fails.
    """
    drive_world, sheets_store = {}, {}

    org_a = make_org("Academy A", "admin_a")
    _connect_google(client, org_a, monkeypatch, drive_world, sheets_store, email="a@example.com")
    student_a = _add_student(client, org_a["headers"], "VS-A-0001")
    client.post(
        "/api/v1/attendance", headers=org_a["headers"],
        json={"student_id": student_a, "date": "2026-10-07", "status": "Present"},
    )

    org_b = make_org("Academy B", "admin_b")
    _connect_google(client, org_b, monkeypatch, drive_world, sheets_store, email="b@example.com")
    student_b = _add_student(client, org_b["headers"], "VS-B-0001")
    client.post(
        "/api/v1/attendance", headers=org_b["headers"],
        json={"student_id": student_b, "date": "2026-10-07", "status": "Absent"},
    )

    a_view = client.get("/api/v1/attendance/date/2026-10-07", headers=org_a["headers"]).json()
    b_view = client.get("/api/v1/attendance/date/2026-10-07", headers=org_b["headers"]).json()

    assert [r["student_id"] for r in a_view["records"]] == [student_a]
    assert [r["student_id"] for r in b_view["records"]] == [student_b]


def test_organization_a_cannot_mark_attendance_for_organization_bs_student(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org_a = make_org("Academy A", "admin_a")
    _connect_google(client, org_a, monkeypatch, drive_world, sheets_store, email="a@example.com")

    org_b = make_org("Academy B", "admin_b")
    student_b = _add_student(client, org_b["headers"], "VS-B-0001")

    response = client.post(
        "/api/v1/attendance", headers=org_a["headers"],
        json={"student_id": student_b, "date": "2026-10-07", "status": "Present"},
    )
    assert response.status_code == 404


def test_staff_accountant_cannot_mark_attendance(client, make_org, db_session, monkeypatch):
    drive_world, sheets_store = {}, {}
    org = make_org("Academy A", "admin_a")
    _connect_google(client, org, monkeypatch, drive_world, sheets_store)
    student_id = _add_student(client, org["headers"])

    db_session.query(User).filter(User.username == "admin_a").update({"role": "STAFF_ACCOUNTANT"})
    db_session.commit()

    response = client.post(
        "/api/v1/attendance", headers=org["headers"],
        json={"student_id": student_id, "date": "2026-10-07", "status": "Present"},
    )
    assert response.status_code == 403


def test_invalid_status_rejected(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org = make_org("Academy A", "admin_a")
    _connect_google(client, org, monkeypatch, drive_world, sheets_store)
    student_id = _add_student(client, org["headers"])

    response = client.post(
        "/api/v1/attendance", headers=org["headers"],
        json={"student_id": student_id, "date": "2026-10-07", "status": "MAYBE"},
    )
    assert response.status_code == 422  # pydantic pattern validation rejects it before the service runs
