from app.models import User


def _create(client, headers, username, role=None):
    body = {"username": username, "full_name_en": "Member Name", "password": "MemberPass1!"}
    if role is not None:
        body["role"] = role
    return client.post("/api/v1/users", headers=headers, json=body)


def _member_id(client, headers, username):
    return next(u["id"] for u in client.get("/api/v1/users", headers=headers).json() if u["username"] == username)


def test_admin_creates_member_with_chosen_role(client, make_org):
    admin = make_org("Academy A", "admin_a")
    created = _create(client, admin["headers"], "acct_one", role="STAFF_ACCOUNTANT")
    assert created.status_code == 201
    assert created.json()["user"]["role"] == "STAFF_ACCOUNTANT"


def test_member_role_defaults_to_instructor(client, make_org):
    admin = make_org("Academy A", "admin_a")
    created = _create(client, admin["headers"], "coach_one")
    assert created.json()["user"]["role"] == "INSTRUCTOR"


def test_admin_roles_cannot_be_assigned_to_members(client, make_org):
    admin = make_org("Academy A", "admin_a")
    for role in ("ADMIN", "SUPER_ADMIN", "STUDENT", "PARENT"):
        assert _create(client, admin["headers"], f"x_{role.lower()}", role=role).status_code == 422


def test_admin_changes_member_role(client, make_org):
    admin = make_org("Academy A", "admin_a")
    _create(client, admin["headers"], "coach_one")
    member_id = _member_id(client, admin["headers"], "coach_one")

    response = client.patch(f"/api/v1/users/{member_id}/role", headers=admin["headers"], json={"role": "STAFF"})
    assert response.status_code == 200
    assert response.json()["role"] == "STAFF"


def test_role_change_rejects_admin_roles_and_own_account(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    admin_id = db_session.query(User).filter(User.username == "admin_a").one().id
    assert client.patch(f"/api/v1/users/{admin_id}/role", headers=admin["headers"], json={"role": "STAFF"}).status_code == 400

    _create(client, admin["headers"], "coach_one")
    assert client.patch(
        f"/api/v1/users/{admin_id}/role", headers=admin["headers"], json={"role": "ADMIN"}
    ).status_code == 422


def test_admin_cannot_change_role_in_another_academy(client, make_org):
    admin_a = make_org("Academy A", "admin_a")
    admin_b = make_org("Academy B", "admin_b")
    _create(client, admin_a["headers"], "coach_one")
    member_id = _member_id(client, admin_a["headers"], "coach_one")

    response = client.patch(f"/api/v1/users/{member_id}/role", headers=admin_b["headers"], json={"role": "STAFF"})
    assert response.status_code == 404


def test_instructor_cannot_change_roles(client, make_org):
    admin = make_org("Academy A", "admin_a")
    _create(client, admin["headers"], "coach_one")
    _create(client, admin["headers"], "coach_two")
    member_id = _member_id(client, admin["headers"], "coach_two")
    token = client.post("/api/v1/auth/login", json={"username": "coach_one", "password": "MemberPass1!"}).json()["access_token"]

    response = client.patch(
        f"/api/v1/users/{member_id}/role", headers={"Authorization": f"Bearer {token}"}, json={"role": "STAFF"}
    )
    assert response.status_code == 403
