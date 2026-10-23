from app.auth.security import hash_password
from app.models import User


def _login(client, username, password):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


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
    token = _login(client, "platform_owner", "PlatformPass1!").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_member(client, admin_headers, username="teacher_one"):
    response = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"username": username, "full_name_en": "Teacher One", "password": "TeacherPass1!"},
    )
    assert response.status_code == 201
    return response.json()


def test_super_admin_license_list_includes_seat_and_academy_licenses(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    _create_member(client, admin["headers"])
    headers = _super_admin_headers(client, db_session)

    rows = client.get("/api/v1/admin/licenses", headers=headers).json()

    seat = [r for r in rows if r["username"] == "teacher_one"]
    assert len(seat) == 1
    assert seat[0]["scope"] == "SEAT"
    assert seat[0]["organization_name"] == "Academy A"
    assert any(r["scope"] == "ACADEMY" and r["organization_name"] == "Academy A" for r in rows)


def test_super_admin_revokes_seat_license_and_member_is_locked_out(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    _create_member(client, admin["headers"])
    headers = _super_admin_headers(client, db_session)
    seat = next(r for r in client.get("/api/v1/admin/licenses", headers=headers).json() if r["username"] == "teacher_one")

    revoke = client.post(f"/api/v1/admin/licenses/{seat['license_id']}/revoke", headers=headers)
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "REVOKED"

    login = _login(client, "teacher_one", "TeacherPass1!")
    assert login.status_code == 403
    assert login.json()["code"] == "LICENSE_REVOKED"


def test_revoke_unknown_license_returns_404(client, make_org, db_session):
    headers = _super_admin_headers(client, db_session)
    response = client.post("/api/v1/admin/licenses/lic_does_not_exist/revoke", headers=headers)
    assert response.status_code == 404


def test_academy_admin_cannot_use_super_admin_license_routes(client, make_org):
    admin = make_org("Academy A", "admin_a")
    assert client.get("/api/v1/admin/licenses", headers=admin["headers"]).status_code == 403
    assert client.post("/api/v1/admin/licenses/lic_x/revoke", headers=admin["headers"]).status_code == 403
