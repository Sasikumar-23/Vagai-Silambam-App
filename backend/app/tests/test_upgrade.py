import datetime

from app.models import License, Subscription
from app.routers.admin import _add_months
from app.tests.test_cash_payments import _org_id, _super_admin_headers
from app.utils.time import as_utc


def _upgrade(client, headers, org_id, plan_code="professional", months=1):
    return client.post(
        f"/api/v1/admin/organizations/{org_id}/upgrade",
        headers=headers,
        json={"plan_code": plan_code, "duration_months": months},
    )


def test_add_months_clamps_to_month_end():
    start = datetime.datetime(2026, 1, 31, tzinfo=datetime.timezone.utc)
    assert _add_months(start, 1) == datetime.datetime(2026, 2, 28, tzinfo=datetime.timezone.utc)
    assert _add_months(start, 12) == datetime.datetime(2027, 1, 31, tzinfo=datetime.timezone.utc)


def test_overview_returns_admin_plan_and_license(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    body = client.get(f"/api/v1/admin/organizations/{org_id}/license-overview", headers=headers).json()
    assert body["admin"]["username"] == "admin_a"
    assert body["organization_name"] == "Academy A"
    assert body["plan_code"]


def test_upgrade_sets_plan_expiry_and_license(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    response = _upgrade(client, headers, org_id, months=3)
    assert response.status_code == 200, response.text

    sub = db_session.query(Subscription).filter(Subscription.organization_id == org_id).one()
    assert sub.status == "ACTIVE"
    assert sub.plan.code == "PROFESSIONAL"
    days = (as_utc(sub.expires_at) - datetime.datetime.now(datetime.timezone.utc)).days
    assert 88 <= days <= 92

    lic = db_session.query(License).filter(License.organization_id == org_id, License.user_id.is_(None)).one()
    assert lic.status == "ACTIVE"
    assert lic.license_key == response.json()["license_key"]
    assert as_utc(lic.expires_at) == as_utc(sub.expires_at)


def test_renewing_the_same_plan_extends_the_current_term(client, make_org, db_session):
    make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    _upgrade(client, headers, org_id, months=1)
    first = db_session.query(Subscription).filter(Subscription.organization_id == org_id).one().expires_at
    second = _upgrade(client, headers, org_id, months=1)
    assert second.status_code == 200
    db_session.expire_all()
    renewed = db_session.query(Subscription).filter(Subscription.organization_id == org_id).one().expires_at
    assert as_utc(renewed) > as_utc(first) + datetime.timedelta(days=27)
    assert db_session.query(License).filter(License.organization_id == org_id, License.user_id.is_(None)).count() == 1


def test_upgrade_rejects_bad_input_and_non_super_admin(client, make_org, db_session):
    admin = make_org("Academy A", "admin_a")
    org_id = _org_id(db_session, "admin_a")
    headers = _super_admin_headers(client, db_session)

    assert _upgrade(client, headers, org_id, months=5).status_code == 400
    assert _upgrade(client, headers, org_id, plan_code="nope").status_code == 404
    assert _upgrade(client, admin["headers"], org_id).status_code == 403
    assert client.get(f"/api/v1/admin/organizations/{org_id}/license-overview", headers=admin["headers"]).status_code == 403
