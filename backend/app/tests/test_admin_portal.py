from app.auth.security import hash_password
from app.models import ApiRequestLog, AuditLog, User


def _super_admin_headers(client, db_session):
    db_session.add(
        User(
            organization_id=None,
            username="platform_owner",
            email="owner@platform.local",
            password_hash=hash_password("PlatformPass1!"),
            full_name_en="Platform Owner",
            role="SUPER_ADMIN",
        )
    )
    db_session.commit()
    token = client.post(
        "/api/v1/auth/login", json={"username": "platform_owner", "password": "PlatformPass1!"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


PLAN = {
    "code": "coaching",
    "name": "Coaching",
    "max_students": 80,
    "max_branches": 1,
    "max_users": 4,
    "price_monthly": 699,
    "price_annual": 6999,
    "sort_order": 9,
    "is_active": True,
}


def test_super_admin_creates_and_edits_plan(client, db_session):
    headers = _super_admin_headers(client, db_session)

    created = client.post("/api/v1/admin/plans", headers=headers, json=PLAN)
    assert created.status_code == 201, created.text
    plan_id = created.json()["id"]
    assert created.json()["code"] == "COACHING"

    public = [p["code"] for p in client.get("/api/v1/plans").json()]
    assert "COACHING" in public

    updated = client.put(
        f"/api/v1/admin/plans/{plan_id}",
        headers=headers,
        json={**{k: v for k, v in PLAN.items() if k != "code"}, "price_monthly": 749, "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["price_monthly"] == 749

    public_after = [p["code"] for p in client.get("/api/v1/plans").json()]
    assert "COACHING" not in public_after
    assert db_session.query(AuditLog).filter(AuditLog.action == "PLAN_UPDATED").count() == 1


def test_duplicate_plan_code_and_bad_limits_are_rejected(client, db_session):
    headers = _super_admin_headers(client, db_session)
    assert client.post("/api/v1/admin/plans", headers=headers, json=PLAN).status_code == 201

    duplicate = client.post("/api/v1/admin/plans", headers=headers, json=PLAN)
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "PLAN_CODE_TAKEN"

    bad = client.post("/api/v1/admin/plans", headers=headers, json={**PLAN, "code": "BROKEN", "max_users": -5})
    assert bad.status_code == 422


def test_academy_admin_cannot_manage_plans_or_activity(client, make_org):
    admin = make_org("Academy A", "admin_a")
    assert client.post("/api/v1/admin/plans", headers=admin["headers"], json=PLAN).status_code == 403
    assert client.get("/api/v1/admin/app-activations", headers=admin["headers"]).status_code == 403
    assert client.get("/api/v1/admin/api-logs", headers=admin["headers"]).status_code == 403


def test_api_requests_are_logged_without_bodies(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    client.get("/api/v1/students", headers=admin["headers"])
    client.get("/health")

    paths = [row.path for row in db_session.query(ApiRequestLog).all()]
    assert "/api/v1/students" in paths
    assert "/health" not in paths

    headers = _super_admin_headers(client, db_session)
    logs = client.get("/api/v1/admin/api-logs?path_contains=students", headers=headers).json()
    assert any(row["username"] == "admin_a" and row["path"] == "/api/v1/students" for row in logs)


def test_failed_login_is_recorded_without_password(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    client.post("/api/v1/auth/login", json={"username": "admin_a", "password": "WrongGuess123"})

    failed = db_session.query(AuditLog).filter(AuditLog.action == "LOGIN_FAILED").one()
    assert "admin_a" in failed.meta
    assert "WrongGuess123" not in failed.meta


def test_app_activations_show_seat_license_state(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    created = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={"username": "coach_one", "full_name_en": "Coach One", "password": "CoachPass123"},
    )
    assert created.status_code == 201
    client.post("/api/v1/auth/login", json={"username": "coach_one", "password": "CoachPass123"})

    headers = _super_admin_headers(client, db_session)
    rows = client.get("/api/v1/admin/app-activations", headers=headers).json()
    coach = next(r for r in rows if r["username"] == "coach_one")
    assert coach["license_status"] == "ACTIVE"
    assert coach["last_login_at"] is not None
    owner = next(r for r in rows if r["username"] == "admin_a")
    assert owner["license_status"] == "NOT_REQUIRED"
