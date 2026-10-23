from app.auth.security import hash_password
from app.models import EmailLog, Payment, User


class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FakeSettings:
    def __init__(self, key):
        self.resend_api_key = key
        self.email_from = "Vagai Silambam <billing@example.com>"


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


def _record_cash(client, headers, org_id, receipt):
    return client.post(
        "/api/v1/admin/subscriptions/record-offline-payment",
        headers=headers,
        json={
            "organization_id": org_id,
            "plan_code": "standard",
            "amount": 999,
            "duration_months": 3,
            "payment_mode": "CASH",
            "receipt_number": receipt,
        },
    )


def _org_id(db_session, username):
    return db_session.query(User).filter(User.username == username).one().organization_id


def test_receipt_is_queued_when_no_provider_key_and_payment_still_recorded(client, make_org, db_session, monkeypatch):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)
    monkeypatch.setattr("app.services.email.get_settings", lambda: _FakeSettings(""))

    assert _record_cash(client, headers, org_id, "RCPT-MAIL-1").status_code == 200

    log = db_session.query(EmailLog).one()
    assert log.status == "PENDING"
    assert log.recipient == "admin_a@example.com"
    assert log.reference == "RCPT-MAIL-1"
    assert "Academy license ID" in log.body
    assert db_session.query(Payment).count() == 1


def test_receipt_is_sent_when_provider_accepts(client, make_org, db_session, monkeypatch):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)
    monkeypatch.setattr("app.services.email.get_settings", lambda: _FakeSettings("re_test"))
    monkeypatch.setattr(
        "app.services.email.httpx.post",
        lambda *a, **k: _FakeResponse(200, {"id": "em_123"}),
    )

    _record_cash(client, headers, org_id, "RCPT-MAIL-2")

    log = db_session.query(EmailLog).one()
    assert log.status == "SENT"
    assert log.provider_message_id == "em_123"
    assert log.sent_at is not None


def test_provider_failure_keeps_payment_and_retry_resends_only_mail(client, make_org, db_session, monkeypatch):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    monkeypatch.setattr("app.services.email.get_settings", lambda: _FakeSettings("re_test"))
    monkeypatch.setattr("app.services.email.httpx.post", lambda *a, **k: _FakeResponse(500))
    assert _record_cash(client, headers, org_id, "RCPT-MAIL-3").status_code == 200

    log = db_session.query(EmailLog).one()
    assert log.status == "FAILED"
    assert "HTTP 500" in log.last_error
    assert db_session.query(Payment).count() == 1

    monkeypatch.setattr("app.services.email.httpx.post", lambda *a, **k: _FakeResponse(200, {"id": "em_9"}))
    retry = client.post("/api/v1/admin/email-logs/retry", headers=headers)
    assert retry.status_code == 200
    assert retry.json()["sent"] == 1

    db_session.refresh(log)
    assert log.status == "SENT"
    assert db_session.query(Payment).count() == 1


def test_email_logs_are_super_admin_only(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    assert client.get("/api/v1/admin/email-logs", headers=admin["headers"]).status_code == 403
    assert client.post("/api/v1/admin/email-logs/retry", headers=admin["headers"]).status_code == 403
