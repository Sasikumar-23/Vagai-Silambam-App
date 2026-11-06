def test_register_returns_tokens_and_the_new_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": "Session Academy",
            "full_name_en": "Session Owner",
            "email": "owner@session.example.com",
            "username": "session_owner",
            "password": "StrongPassw0rd!",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["username"] == "session_owner"
    assert body["user"]["role"] == "ADMIN"
    assert body["organization_id"] == body["user"]["organization_id"]


def test_login_returns_tokens_and_the_user(client, make_org):
    make_org("Academy A", "admin_a")
    body = client.post(
        "/api/v1/auth/login", json={"username": "admin_a", "password": "StrongPassw0rd!"}
    ).json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["id"]
    assert body["user"]["username"] == "admin_a"
    assert body["organization_id"] == body["user"]["organization_id"]


def test_refresh_still_returns_tokens_only(client, make_org):
    make_org("Academy A", "admin_a")
    refresh_token = client.post(
        "/api/v1/auth/login", json={"username": "admin_a", "password": "StrongPassw0rd!"}
    ).json()["refresh_token"]
    body = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token}).json()
    assert body["access_token"]
    assert "user" not in body


def test_login_picks_the_account_whose_password_matches(client, make_org, db_session):
    from app.auth.security import hash_password
    from app.models import Organization, User

    make_org("Academy A", "shared")  # StrongPassw0rd!
    other = Organization(organization_code="VS-ORG-77777", name="Academy B", email="b@example.com")
    db_session.add(other)
    db_session.flush()
    db_session.add(
        User(
            organization_id=other.id,
            username="shared",  # usernames only have to be unique inside one academy
            email="shared@b.local",
            password_hash=hash_password("AnotherPassw0rd!"),
            full_name_en="Second Shared",
            role="ADMIN",
        )
    )
    db_session.commit()

    first = client.post("/api/v1/auth/login", json={"username": "shared", "password": "StrongPassw0rd!"})
    second = client.post("/api/v1/auth/login", json={"username": "shared", "password": "AnotherPassw0rd!"})
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["user"]["full_name_en"] != second.json()["user"]["full_name_en"]

    wrong = client.post("/api/v1/auth/login", json={"username": "shared", "password": "nope-nope-nope"})
    assert wrong.status_code == 401


def test_login_still_accepts_the_email(client, make_org):
    make_org("Academy A", "admin_a")
    response = client.post(
        "/api/v1/auth/login", json={"username": "Admin_A@Example.com", "password": "StrongPassw0rd!"}
    )
    assert response.status_code == 200
