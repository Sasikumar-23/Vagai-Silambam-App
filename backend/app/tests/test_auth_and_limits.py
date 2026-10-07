from datetime import datetime, timedelta, timezone

from app.auth.security import hash_password, verify_password
from app.models import Plan, Student, Subscription, User
from app.utils.time import as_utc


def test_passwords_are_argon2_hashed_not_stored(db_session, client, make_org):
    make_org("Academy A", "admin_a")
    user = db_session.query(User).filter(User.username == "admin_a").one()

    assert "StrongPassw0rd!" not in user.password_hash
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password("StrongPassw0rd!", user.password_hash)
    assert not verify_password("wrong-password", user.password_hash)


def test_argon2_salts_differ_for_same_password():
    assert hash_password("same-password") != hash_password("same-password")


def test_login_succeeds_and_rejects_bad_password(client, make_org):
    make_org("Academy A", "admin_a")

    ok = client.post("/api/v1/auth/login", json={"username": "admin_a", "password": "StrongPassw0rd!"})
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = client.post("/api/v1/auth/login", json={"username": "admin_a", "password": "nope"})
    assert bad.status_code == 401
    assert bad.json()["code"] == "UNAUTHENTICATED"


def test_signup_creates_trial_license_and_org_code(db_session, client, make_org):
    make_org("Academy A", "admin_a")

    subscription = db_session.query(Subscription).one()
    assert subscription.status == "TRIAL"
    assert as_utc(subscription.trial_end) > datetime.now(timezone.utc)

    body = client.get(
        "/api/v1/subscription",
        headers=make_org("Academy B", "admin_b")["headers"],
    ).json()
    assert body["organization_code"].startswith("VS-ORG-")
    assert body["license_key"].startswith("VS-")
    assert len(body["license_key"]) == 17  # VS-XXXX-XXXX-XXXX


def test_license_keys_are_unpredictable():
    from app.services.provisioning import generate_license_key

    keys = {generate_license_key() for _ in range(500)}
    assert len(keys) == 500


def test_plan_limit_blocks_the_next_student(db_session, client, make_org):
    org = make_org("Academy A", "admin_a")

    # Shrink the plan rather than creating 50 students.
    plan = db_session.query(Plan).filter(Plan.code == "STARTER").one()
    plan.max_students = 2
    db_session.commit()

    for i in range(2):
        created = client.post(
            "/api/v1/students",
            headers=org["headers"],
            json={"student_code": f"VS-A-{i}", "name_en": f"Student {i}"},
        )
        assert created.status_code == 201

    blocked = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-A-3", "name_en": "One too many"},
    )
    assert blocked.status_code == 402
    assert blocked.json()["code"] == "PLAN_LIMIT_REACHED"
    assert db_session.query(Student).count() == 2


def test_expired_trial_blocks_access_but_keeps_data(db_session, client, make_org):
    org = make_org("Academy A", "admin_a")
    client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-A-0001", "name_en": "Student"},
    )

    subscription = db_session.query(Subscription).one()
    subscription.trial_end = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    blocked = client.get("/api/v1/students", headers=org["headers"])
    assert blocked.status_code == 402
    assert blocked.json()["code"] == "TRIAL_EXPIRED"

    # Data is retained, not deleted.
    assert db_session.query(Student).count() == 1


def test_instructor_cannot_deactivate_students(db_session, client, make_org):
    org = make_org("Academy A", "admin_a")
    student = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-A-0001", "name_en": "Student"},
    ).json()

    db_session.query(User).filter(User.username == "admin_a").one().role = "INSTRUCTOR"
    db_session.commit()

    response = client.delete(f"/api/v1/students/{student['id']}", headers=org["headers"])
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_suspended_organization_is_locked_out(db_session, client, make_org):
    from app.models import Organization

    org = make_org("Academy A", "admin_a")
    db_session.query(Organization).one().status = "SUSPENDED"
    db_session.commit()

    response = client.get("/api/v1/students", headers=org["headers"])
    assert response.status_code == 403
    assert response.json()["code"] == "ORGANIZATION_SUSPENDED"


def test_audit_log_never_stores_passwords(db_session, client, make_org):
    make_org("Academy A", "admin_a")
    from app.models import AuditLog

    entries = db_session.query(AuditLog).all()
    assert entries
    for entry in entries:
        assert "StrongPassw0rd!" not in (entry.meta or "")
