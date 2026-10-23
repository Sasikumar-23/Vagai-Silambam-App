from app.auth.security import hash_password
from app.models import Payment, User


def _create_user(client, headers, username, password="TeacherPass1!", role_hint=None):
    return client.post(
        "/api/v1/users",
        headers=headers,
        json={"username": username, "full_name_en": "Staff Member", "password": password},
    )


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


def test_public_password_reset_endpoint_is_gone(client):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"username": "anyone", "new_password": "AttackerPass1!"},
    )
    assert response.status_code in (404, 405)


def test_admin_account_is_not_blocked_by_license_rules(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    owner = db_session.query(User).filter(User.username == "admin_a").one()
    second_admin = User(
        organization_id=owner.organization_id,
        username="admin_two",
        email="admin_two@academy-a.local",
        password_hash=hash_password("SecondAdmin1!"),
        full_name_en="Second Admin",
        role="ADMIN",
    )
    db_session.add(second_admin)
    db_session.commit()

    assert client.get("/api/v1/auth/me", headers=admin["headers"]).status_code == 200
    assert _login(client, "admin_two", "SecondAdmin1!").status_code == 200

    # Admin accounts don't use seat licenses, so the license action is refused.
    response = client.post(f"/api/v1/users/{second_admin.id}/license/revoke", headers=admin["headers"])
    assert response.status_code == 400
    assert response.json()["code"] == "ADMIN_ACCOUNT_NOT_LICENSED"


def test_admin_resets_member_password_and_old_password_stops_working(client, make_org):
    admin = make_org("Academy A", "admin_a")
    created = _create_user(client, admin["headers"], "teacher_one")
    user_id = created.json()["user"]["id"]

    reset = client.post(
        f"/api/v1/users/{user_id}/reset-password",
        headers=admin["headers"],
        json={"new_password": "BrandNewPass2!"},
    )
    assert reset.status_code == 204

    assert _login(client, "teacher_one", "TeacherPass1!").status_code == 401
    assert _login(client, "teacher_one", "BrandNewPass2!").status_code == 200


def test_admin_cannot_reset_password_of_another_academy_user(client, make_org):
    admin_a = make_org("Academy A", "admin_a")
    admin_b = make_org("Academy B", "admin_b")
    user_a_id = _create_user(client, admin_a["headers"], "teacher_one").json()["user"]["id"]

    response = client.post(
        f"/api/v1/users/{user_a_id}/reset-password",
        headers=admin_b["headers"],
        json={"new_password": "HijackPass2!"},
    )
    assert response.status_code == 404
    assert _login(client, "teacher_one", "TeacherPass1!").status_code == 200


def test_instructor_cannot_reset_passwords(client, make_org):
    admin = make_org("Academy A", "admin_a")
    teacher_id = _create_user(client, admin["headers"], "teacher_one").json()["user"]["id"]
    teacher_token = _login(client, "teacher_one", "TeacherPass1!").json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    response = client.post(
        f"/api/v1/users/{teacher_id}/reset-password",
        headers=teacher_headers,
        json={"new_password": "HijackPass2!"},
    )
    assert response.status_code == 403


def test_super_admin_resets_academy_admin_password(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = db_session.query(User).filter(User.username == "admin_a").one().organization_id
    headers = _super_admin_headers(client, db_session)

    reset = client.post(
        f"/api/v1/admin/organizations/{org_id}/reset-admin-password",
        headers=headers,
        json={"new_password": "RecoveredPass3!"},
    )
    assert reset.status_code == 204
    assert _login(client, "admin_a", "StrongPassw0rd!").status_code == 401
    assert _login(client, "admin_a", "RecoveredPass3!").status_code == 200


def test_offline_payment_rejects_invalid_amount_and_duration(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = db_session.query(User).filter(User.username == "admin_a").one().organization_id
    headers = _super_admin_headers(client, db_session)
    base = {"organization_id": org_id, "plan_code": "STANDARD", "payment_mode": "CASH"}

    assert client.post(
        "/api/v1/admin/subscriptions/record-offline-payment",
        headers=headers,
        json={**base, "amount": 0, "duration_months": 1},
    ).json()["code"] == "INVALID_AMOUNT"

    assert client.post(
        "/api/v1/admin/subscriptions/record-offline-payment",
        headers=headers,
        json={**base, "amount": 999, "duration_months": 2},
    ).json()["code"] == "INVALID_DURATION"

    assert db_session.query(Payment).count() == 0


def test_academy_admin_cannot_record_offline_payment(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    org_id = db_session.query(User).filter(User.username == "admin_a").one().organization_id

    response = client.post(
        "/api/v1/admin/subscriptions/record-offline-payment",
        headers=admin["headers"],
        json={"organization_id": org_id, "plan_code": "STANDARD", "amount": 999, "duration_months": 1},
    )
    assert response.status_code == 403
