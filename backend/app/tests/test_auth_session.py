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
