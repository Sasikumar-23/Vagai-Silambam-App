from app.tests.test_attendance_router import _connect_google


def _batch(client, headers, *records):
    return client.post("/api/v1/attendance/batch", headers=headers, json={"records": list(records)})


def _row(code, status="Present", date="2026-11-07", session="Weekend"):
    return {"student_id": code, "student_name": f"Student {code}", "date": date, "session_name": session, "status": status}


def test_batch_requires_google_connection(client, make_org):
    org = make_org("Academy A", "admin_a")
    response = _batch(client, org["headers"], _row("VS-0001"))
    assert response.status_code == 400
    assert response.json()["code"] == "GOOGLE_NOT_CONNECTED"


def test_batch_writes_a_session_and_updates_it_in_place(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org = make_org("Academy A", "admin_a")
    _connect_google(client, org, monkeypatch, drive_world, sheets_store)

    first = _batch(client, org["headers"], _row("VS-0001"), _row("VS-0002", "Absent"))
    assert first.status_code == 200 and first.json()["saved"] == 2

    # Re-saving the same session changes the rows instead of adding new ones.
    again = _batch(client, org["headers"], _row("VS-0002", "Late"), _row("VS-0003"))
    assert again.status_code == 200

    records = client.get("/api/v1/attendance/date/2026-11-07", headers=org["headers"]).json()["records"]
    by_student = {r["student_id"]: r["status"] for r in records}
    assert by_student == {"VS-0001": "Present", "VS-0002": "Late", "VS-0003": "Present"}
    assert len(records) == 3


def test_batch_rows_stay_with_their_academy(client, make_org, monkeypatch):
    drive_world, sheets_store = {}, {}
    org_a = make_org("Academy A", "admin_a")
    org_b = make_org("Academy B", "admin_b")
    _connect_google(client, org_a, monkeypatch, drive_world, sheets_store, email="a@example.com")
    _connect_google(client, org_b, monkeypatch, drive_world, sheets_store, email="b@example.com")

    _batch(client, org_a["headers"], _row("VS-0001", "Present"))
    _batch(client, org_b["headers"], _row("VS-0001", "Absent"))

    a = client.get("/api/v1/attendance/date/2026-11-07", headers=org_a["headers"]).json()["records"]
    b = client.get("/api/v1/attendance/date/2026-11-07", headers=org_b["headers"]).json()["records"]
    assert [r["status"] for r in a] == ["Present"]
    assert [r["status"] for r in b] == ["Absent"]


def test_batch_rejects_bad_input_and_staff(client, make_org):
    org = make_org("Academy A", "admin_a")
    assert _batch(client, org["headers"], _row("VS-0001", "Maybe")).status_code == 422
    assert client.post("/api/v1/attendance/batch", headers=org["headers"], json={"records": []}).status_code == 422

    staff = client.post(
        "/api/v1/users", headers=org["headers"],
        json={"username": "accounts", "full_name_en": "Accounts", "password": "StrongPassw0rd!", "role": "STAFF_ACCOUNTANT"},
    )
    assert staff.status_code == 201, staff.text
    token = client.post("/api/v1/auth/login", json={"username": "accounts", "password": "StrongPassw0rd!"}).json()["access_token"]
    assert _batch(client, {"Authorization": f"Bearer {token}"}, _row("VS-0001")).status_code == 403
