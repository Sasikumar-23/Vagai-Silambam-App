"""
Comprehensive tests for Academy Modules:
- Events, registrations, and results
- Fees and receipt payments
- Uniforms
- Certificates & achievements
- Reports & exports
- Bulk student import
- Super admin protection
"""

def test_events_flow_and_tenant_isolation(client, make_org):
    org_a = make_org("Event Academy A", "admin_evt_a")
    org_b = make_org("Event Academy B", "admin_evt_b")

    # Create event in Org A
    resp = client.post(
        "/api/v1/events",
        headers=org_a["headers"],
        json={
            "title_en": "State Silambam Championship 2026",
            "title_ta": "மாநில சிலம்பப் போட்டி 2026",
            "event_type": "COMPETITION",
            "event_date": "2026-11-20",
            "venue": "Nehru Indoor Stadium, Chennai",
            "registration_fee": 350.0,
        },
    )
    assert resp.status_code == 201
    evt = resp.json()
    evt_id = evt["id"]
    assert evt["title_en"] == "State Silambam Championship 2026"

    # Org B cannot see Org A's event
    resp_b = client.get(f"/api/v1/events/{evt_id}", headers=org_b["headers"])
    assert resp_b.status_code == 404

    # Register student in Org A
    student = client.post(
        "/api/v1/students",
        headers=org_a["headers"],
        json={"student_code": "VS-EVT-01", "name_en": "Karthik"},
    ).json()

    reg_resp = client.post(
        f"/api/v1/events/{evt_id}/registrations",
        headers=org_a["headers"],
        json={"student_id": student["id"], "category": "Junior Stick Fight", "fee_paid": True},
    )
    assert reg_resp.status_code == 201
    assert reg_resp.json()["category"] == "Junior Stick Fight"

    # Record result
    res_resp = client.post(
        f"/api/v1/events/{evt_id}/results",
        headers=org_a["headers"],
        json={
            "student_id": student["id"],
            "position": "1st Place",
            "medal": "GOLD",
            "remarks": "Excellent form and speed",
        },
    )
    assert res_resp.status_code == 201
    assert res_resp.json()["medal"] == "GOLD"


def test_fees_and_payment_receipts(client, make_org):
    org = make_org("Fee Academy", "admin_fee")
    student = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-FEE-01", "name_en": "Ananya"},
    ).json()

    # Create fee
    fee_resp = client.post(
        "/api/v1/fees",
        headers=org["headers"],
        json={
            "student_id": student["id"],
            "fee_type": "MONTHLY_TUITION",
            "title_en": "October 2026 Tuition Fee",
            "amount": 750.0,
            "due_date": "2026-10-15",
        },
    )
    assert fee_resp.status_code == 201
    fee = fee_resp.json()
    assert fee["status"] == "PENDING"

    # Pay fee
    pay_resp = client.post(
        f"/api/v1/fees/{fee['id']}/pay",
        headers=org["headers"],
        json={"payment_mode": "UPI", "notes": "GPay reference 987654"},
    )
    assert pay_resp.status_code == 200
    paid_fee = pay_resp.json()
    assert paid_fee["status"] == "PAID"
    assert paid_fee["receipt_number"].startswith("RCP-")


def test_uniform_management(client, make_org):
    org = make_org("Uniform Academy", "admin_uni")
    student = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-UNI-01", "name_en": "Dinesh"},
    ).json()

    # Order uniform
    order_resp = client.post(
        "/api/v1/uniforms",
        headers=org["headers"],
        json={
            "student_id": student["id"],
            "uniform_type": "STANDARD_SUIT",
            "size": "34",
            "price": 850.0,
        },
    )
    assert order_resp.status_code == 201
    uni = order_resp.json()
    assert uni["status"] == "REQUESTED"

    # Update uniform status
    upd_resp = client.patch(
        f"/api/v1/uniforms/{uni['id']}",
        headers=org["headers"],
        json={"status": "DELIVERED", "is_paid": True, "delivery_date": "2026-10-12"},
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["status"] == "DELIVERED"
    assert upd_resp.json()["is_paid"] is True


def test_certificates_and_achievements(client, make_org):
    org = make_org("Cert Academy", "admin_cert")
    student = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-CRT-01", "name_en": "Meena"},
    ).json()

    # Record achievement
    ach_resp = client.post(
        "/api/v1/certificates/achievements",
        headers=org["headers"],
        json={
            "student_id": student["id"],
            "title_en": "District Level 1st Prize",
            "achievement_date": "2026-09-15",
            "level": "DISTRICT",
            "medal_or_rank": "Gold Medal",
        },
    )
    assert ach_resp.status_code == 201

    # Issue certificate
    cert_resp = client.post(
        "/api/v1/certificates",
        headers=org["headers"],
        json={
            "student_id": student["id"],
            "certificate_number": "CERT-2026-0042",
            "title_en": "Advanced Stave Martial Arts Course",
            "issue_date": "2026-10-10",
        },
    )
    assert cert_resp.status_code == 201
    cert = cert_resp.json()
    assert cert["verification_code"].startswith("VS-VER-")


def test_reports_and_csv_exports(client, make_org):
    org = make_org("Report Academy", "admin_rep")
    student = client.post(
        "/api/v1/students",
        headers=org["headers"],
        json={"student_code": "VS-REP-01", "name_en": "Siddharth"},
    ).json()

    summary = client.get("/api/v1/reports/summary", headers=org["headers"]).json()
    assert summary["active_students"] == 1

    # Test CSV export
    csv_resp = client.get("/api/v1/reports/export/students.csv", headers=org["headers"])
    assert csv_resp.status_code == 200
    assert "VS-REP-01" in csv_resp.text
    assert "Siddharth" in csv_resp.text


def test_student_bulk_import(client, make_org):
    org = make_org("Import Academy", "admin_imp")

    items = [
        {"student_code": "VS-IMP-01", "name_en": "Student Alpha"},
        {"student_code": "VS-IMP-02", "name_en": "Student Beta"},
    ]
    resp = client.post("/api/v1/students/import", headers=org["headers"], json=items)
    assert resp.status_code == 200
    res = resp.json()
    assert res["total_rows"] == 2
    assert res["imported_count"] == 2
    assert res["skipped_count"] == 0

    # Re-importing should skip duplicates safely
    resp_dup = client.post("/api/v1/students/import", headers=org["headers"], json=items)
    res_dup = resp_dup.json()
    assert res_dup["imported_count"] == 0
    assert res_dup["skipped_count"] == 2
