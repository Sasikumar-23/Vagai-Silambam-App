from app.models import License, User


def _create_user(client, headers, username="teacher_one", password="TeacherPass1!"):
    return client.post(
        "/api/v1/users",
        headers=headers,
        json={"username": username, "full_name_en": "Teacher One", "password": password},
    )


def _login(client, username, password):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def test_admin_creates_user_with_license_and_user_can_login(client, make_org):
    admin = make_org("Academy A", "admin_a")

    created = _create_user(client, admin["headers"])
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["license_key"].startswith("VS-")
    assert body["user"]["license_status"] == "ACTIVE"
    assert body["user"]["role"] == "INSTRUCTOR"

    login = _login(client, "teacher_one", "TeacherPass1!")
    assert login.status_code == 200, login.text
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "teacher_one"


def test_wrong_password_is_rejected_even_with_license(client, make_org):
    admin = make_org("Academy A", "admin_a")
    _create_user(client, admin["headers"])

    assert _login(client, "teacher_one", "not-the-password").status_code == 401


def test_revoked_license_blocks_login_and_existing_session(client, make_org):
    admin = make_org("Academy A", "admin_a")
    created = _create_user(client, admin["headers"])
    user_id = created.json()["user"]["id"]

    teacher_token = _login(client, "teacher_one", "TeacherPass1!").json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    assert client.get("/api/v1/auth/me", headers=teacher_headers).status_code == 200

    revoked = client.post(f"/api/v1/users/{user_id}/license/revoke", headers=admin["headers"])
    assert revoked.status_code == 200
    assert revoked.json()["license_status"] == "REVOKED"

    blocked_login = _login(client, "teacher_one", "TeacherPass1!")
    assert blocked_login.status_code == 403
    assert blocked_login.json()["code"] == "LICENSE_REVOKED"

    blocked_session = client.get("/api/v1/auth/me", headers=teacher_headers)
    assert blocked_session.status_code == 403
    assert blocked_session.json()["code"] == "LICENSE_REVOKED"


def test_reissue_creates_new_key_and_restores_login(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    created = _create_user(client, admin["headers"])
    user_id = created.json()["user"]["id"]
    first_key = created.json()["license_key"]

    client.post(f"/api/v1/users/{user_id}/license/revoke", headers=admin["headers"])
    reissued = client.post(f"/api/v1/users/{user_id}/license/reissue", headers=admin["headers"])
    assert reissued.status_code == 200
    assert reissued.json()["license_key"] != first_key
    assert reissued.json()["user"]["license_status"] == "ACTIVE"

    assert _login(client, "teacher_one", "TeacherPass1!").status_code == 200
    assert db_session.query(License).filter(License.user_id == user_id, License.status == "REVOKED").count() == 1
    assert db_session.query(License).filter(License.user_id == user_id, License.status == "ACTIVE").count() == 1


def test_instructor_cannot_create_users(client, make_org):
    admin = make_org("Academy A", "admin_a")
    _create_user(client, admin["headers"])
    teacher = _login(client, "teacher_one", "TeacherPass1!").json()
    teacher_headers = {"Authorization": f"Bearer {teacher['access_token']}"}

    response = _create_user(client, teacher_headers, username="another")
    assert response.status_code == 403


def test_admin_cannot_revoke_own_license(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    admin_id = db_session.query(User).filter(User.username == "admin_a").one().id

    response = client.post(f"/api/v1/users/{admin_id}/license/revoke", headers=admin["headers"])
    assert response.status_code == 400
    assert response.json()["code"] == "CANNOT_REVOKE_OWN_LICENSE"


def test_duplicate_username_is_rejected(client, make_org):
    admin = make_org("Academy A", "admin_a")
    assert _create_user(client, admin["headers"]).status_code == 201

    duplicate = _create_user(client, admin["headers"])
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "USERNAME_TAKEN"


def test_starter_plan_user_limit_is_enforced(client, make_org):
    admin = make_org("Academy A", "admin_a")
    # STARTER allows 5 users; the admin already counts as one.
    for i in range(4):
        assert _create_user(client, admin["headers"], username=f"teacher_{i}").status_code == 201

    blocked = _create_user(client, admin["headers"], username="teacher_extra")
    assert blocked.status_code >= 400
    assert blocked.json()["code"] == "PLAN_LIMIT_REACHED"


def test_admin_cannot_manage_another_academys_users(client, make_org, db_session):
    admin_a = make_org("Academy A", "admin_a")
    admin_b = make_org("Academy B", "admin_b")
    created = _create_user(client, admin_a["headers"])
    user_a_id = created.json()["user"]["id"]

    revoke = client.post(f"/api/v1/users/{user_a_id}/license/revoke", headers=admin_b["headers"])
    assert revoke.status_code == 404

    listing = client.get("/api/v1/users", headers=admin_b["headers"]).json()
    assert all(row["id"] != user_a_id for row in listing)
