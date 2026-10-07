"""
THE critical SaaS test: Organization A must never reach Organization B's data,
through any verb, and must not be able to forge its way in via the request body.
"""


def _create_student(client, headers, code="VS-2026-0001", name="Student One"):
    response = client.post(
        "/api/v1/students",
        headers=headers,
        json={"student_code": code, "name_en": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_organization_a_cannot_read_organization_b_student(client, make_org):
    org_a = make_org("Academy A", "admin_a")
    org_b = make_org("Academy B", "admin_b")

    student_b = _create_student(client, org_b["headers"], "VS-B-0001", "B Student")

    response = client.get(f"/api/v1/students/{student_b['id']}", headers=org_a["headers"])
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_listing_never_leaks_other_tenants(client, make_org):
    org_a = make_org("Academy A", "admin_a")
    org_b = make_org("Academy B", "admin_b")

    _create_student(client, org_a["headers"], "VS-A-0001", "A Student")
    _create_student(client, org_b["headers"], "VS-B-0001", "B Student")

    body = client.get("/api/v1/students", headers=org_a["headers"]).json()
    codes = {item["student_code"] for item in body["items"]}

    assert codes == {"VS-A-0001"}
    assert body["meta"]["total"] == 1


def test_organization_a_cannot_update_or_deactivate_b(client, make_org):
    org_a = make_org("Academy A", "admin_a")
    org_b = make_org("Academy B", "admin_b")
    student_b = _create_student(client, org_b["headers"], "VS-B-0001", "B Student")

    update = client.put(
        f"/api/v1/students/{student_b['id']}",
        headers=org_a["headers"],
        json={"name_en": "Hijacked"},
    )
    assert update.status_code == 404

    delete = client.delete(f"/api/v1/students/{student_b['id']}", headers=org_a["headers"])
    assert delete.status_code == 404

    # B's record is untouched
    still_there = client.get(f"/api/v1/students/{student_b['id']}", headers=org_b["headers"])
    assert still_there.status_code == 200
    assert still_there.json()["name_en"] == "B Student"


def test_organization_id_in_request_body_is_ignored(client, make_org):
    """A forged organization_id must not move a record into another tenant."""
    org_a = make_org("Academy A", "admin_a")
    org_b = make_org("Academy B", "admin_b")

    b_subscription = client.get("/api/v1/subscription", headers=org_b["headers"]).json()
    assert b_subscription["usage"]["students"] == 0

    response = client.post(
        "/api/v1/students",
        headers=org_a["headers"],
        json={
            "student_code": "VS-A-0002",
            "name_en": "Injected",
            "organization_id": "org_does_not_matter",
        },
    )
    assert response.status_code == 201

    # The student landed in A, and B still has none.
    assert client.get("/api/v1/subscription", headers=org_b["headers"]).json()["usage"]["students"] == 0
    assert client.get("/api/v1/subscription", headers=org_a["headers"]).json()["usage"]["students"] == 1


def test_requests_without_a_token_are_rejected(client, make_org):
    make_org("Academy A", "admin_a")
    assert client.get("/api/v1/students").status_code == 401


def test_tampered_token_is_rejected(client, make_org):
    org_a = make_org("Academy A", "admin_a")
    tampered = org_a["token"][:-4] + "AAAA"
    response = client.get("/api/v1/students", headers={"Authorization": f"Bearer {tampered}"})
    assert response.status_code == 401
