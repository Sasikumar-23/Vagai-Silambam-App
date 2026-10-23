from app.auth.security import hash_password
from app.models import License, Payment, Subscription, User


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


def _org_id(db_session, username):
    return db_session.query(User).filter(User.username == username).one().organization_id


def _record(client, headers, org_id, **overrides):
    body = {
        "organization_id": org_id,
        "plan_code": "standard",
        "amount": 999,
        "duration_months": 1,
        "payment_mode": "CASH",
        "receipt_number": "RCPT-0001",
    }
    body.update(overrides)
    return client.post("/api/v1/admin/subscriptions/record-offline-payment", headers=headers, json=body)


def test_cash_payment_activates_subscription_and_license(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    response = _record(client, headers, org_id)
    assert response.status_code == 200, response.text

    subscription = db_session.query(Subscription).filter(Subscription.organization_id == org_id).one()
    assert subscription.status == "ACTIVE"
    assert subscription.plan.code == "STANDARD"
    assert db_session.query(Payment).filter(Payment.organization_id == org_id).count() == 1
    assert db_session.query(License).filter(License.organization_id == org_id, License.user_id.is_(None), License.status == "ACTIVE").count() >= 1


def test_duplicate_receipt_is_rejected(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    assert _record(client, headers, org_id).status_code == 200
    second = _record(client, headers, org_id)
    assert second.status_code == 409
    assert second.json()["code"] == "DUPLICATE_RECEIPT"
    assert db_session.query(Payment).count() == 1


def test_generate_license_is_idempotent(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    first = client.post(f"/api/v1/admin/organizations/{org_id}/generate-license", headers=headers, json={})
    second = client.post(f"/api/v1/admin/organizations/{org_id}/generate-license", headers=headers, json={})
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["license_key"] == second.json()["license_key"]


def test_admin_pages_endpoints_require_super_admin(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")

    assert client.get("/api/v1/admin/payments", headers=admin["headers"]).status_code == 403
    assert client.get("/api/v1/admin/licenses", headers=admin["headers"]).status_code == 403
    assert client.post(f"/api/v1/admin/organizations/{org_id}/generate-license", headers=admin["headers"], json={}).status_code == 403


def test_super_admin_lists_payments_and_licenses(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)
    _record(client, headers, org_id, receipt_number="RCPT-LIST-1")

    payments = client.get("/api/v1/admin/payments", headers=headers).json()
    assert any(p["receipt_number"] == "RCPT-LIST-1" and p["organization_name"] == "Academy A" for p in payments)

    licenses = client.get("/api/v1/admin/licenses", headers=headers).json()
    assert any(row["organization_name"] == "Academy A" for row in licenses)


def test_legacy_admin_reset_route_is_gone(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    headers = _super_admin_headers(client, db_session)
    response = client.post("/api/v1/admin/reset-password", headers=headers, json={"new_password": "XxxxxxxxX1"})
    assert response.status_code in (404, 405)
