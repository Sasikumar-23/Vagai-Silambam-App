"""
Unit tests for the Drive/Sheets wrappers and the retry decorator, run against the
in-memory fakes in tests/fakes/google_api.py — there is no live Google account in
this environment. These prove the integration *logic* (idempotent provisioning,
attendance upsert, duplicate prevention, backoff) independent of real network calls.
"""

import pytest

from app.integrations.google_drive import DriveClient
from app.integrations.google_sheets import SheetsClient
from app.integrations.retry import with_backoff
from app.tests.fakes.google_api import FlakyExecutable, make_http_error, patch_google_apis


# ── retry / backoff ──────────────────────────────────────────────


def test_retries_on_rate_limit_then_succeeds(monkeypatch):
    monkeypatch.setattr("app.integrations.retry.time.sleep", lambda _: None)
    attempts = FlakyExecutable(lambda: "ok", fail_times=2, status=429)

    @with_backoff(max_attempts=5, base_delay=0.001)
    def call():
        return attempts.execute()

    assert call() == "ok"
    assert attempts.calls == 3


def test_gives_up_after_max_attempts(monkeypatch):
    monkeypatch.setattr("app.integrations.retry.time.sleep", lambda _: None)

    @with_backoff(max_attempts=3, base_delay=0.001)
    def always_fails():
        raise make_http_error(503)

    with pytest.raises(Exception):
        always_fails()


def test_non_retryable_status_raises_immediately(monkeypatch):
    calls = {"n": 0}
    monkeypatch.setattr("app.integrations.retry.time.sleep", lambda _: None)

    @with_backoff(max_attempts=5, base_delay=0.001)
    def not_found():
        calls["n"] += 1
        raise make_http_error(404)

    with pytest.raises(Exception):
        not_found()
    assert calls["n"] == 1  # no retry for a non-retryable status


# ── Drive folder provisioning ────────────────────────────────────


def test_drive_folder_provisioning_is_idempotent(monkeypatch):
    world = {}
    patch_google_apis(monkeypatch, world, {})
    client = DriveClient(credentials=None)

    first = client.provision_organization_folders("Academy A")
    second = client.provision_organization_folders("Academy A")

    assert first == second  # re-running (e.g. reconnect) must not duplicate folders
    folder_names = {meta["name"] for meta in world.values()}
    assert "Student Photos" in folder_names
    assert "Certificates" in folder_names
    assert "Event Documents" in folder_names
    assert "Other Files" in folder_names
    # exactly one of each: a root + 5 subfolders, no duplicates from the second call
    assert len(world) == 6


def test_two_organizations_get_separate_root_folders(monkeypatch):
    world = {}
    patch_google_apis(monkeypatch, world, {})
    client = DriveClient(credentials=None)

    a = client.provision_organization_folders("Academy A")
    b = client.provision_organization_folders("Academy B")

    assert a["root_folder_id"] != b["root_folder_id"]
    assert a["photos_folder_id"] != b["photos_folder_id"]


# ── Sheets attendance ─────────────────────────────────────────────


def test_spreadsheet_provisioning_writes_header_once(monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    client = SheetsClient(credentials=None)

    sid = client.ensure_spreadsheet("Attendance - Academy A", "Attendance")
    client.ensure_spreadsheet("Attendance - Academy A", "Attendance")  # idempotent

    assert sheets_store[sid]["Attendance"][0][0] == "attendance_id"
    assert len(sheets_store[sid]["Attendance"]) == 1  # header not duplicated


def test_mark_attendance_appends_new_row(monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    client = SheetsClient(credentials=None)
    sid = client.ensure_spreadsheet("Attendance", "Attendance")

    attendance_id = client.mark_attendance(
        sid, "Attendance", organization_id="org_a", date="2026-10-07",
        student_id="stu_1", student_name="Anbarasu", session_name="Morning",
        status="Present", remarks="", marked_by="Coach",
    )

    rows = client.read_all_rows(sid, "Attendance")
    assert len(rows) == 1
    assert rows[0]["attendance_id"] == attendance_id
    assert rows[0]["status"] == "Present"
    assert rows[0]["organization_id"] == "org_a"


def test_marking_same_student_date_session_twice_updates_not_duplicates(monkeypatch):
    """The exact rule from the brief: student + date + session must never produce two rows."""
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    client = SheetsClient(credentials=None)
    sid = client.ensure_spreadsheet("Attendance", "Attendance")

    first_id = client.mark_attendance(
        sid, "Attendance", organization_id="org_a", date="2026-10-07",
        student_id="stu_1", student_name="Anbarasu", session_name="Morning",
        status="Absent", remarks="sick", marked_by="Coach",
    )
    second_id = client.mark_attendance(
        sid, "Attendance", organization_id="org_a", date="2026-10-07",
        student_id="stu_1", student_name="Anbarasu", session_name="Morning",
        status="Present", remarks="", marked_by="Coach",
    )

    rows = client.read_all_rows(sid, "Attendance")
    assert len(rows) == 1  # updated in place, not appended
    assert first_id == second_id  # same attendance_id preserved across the correction
    assert rows[0]["status"] == "Present"
    assert rows[0]["remarks"] == ""


def test_different_sessions_same_day_are_separate_rows(monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    client = SheetsClient(credentials=None)
    sid = client.ensure_spreadsheet("Attendance", "Attendance")

    client.mark_attendance(
        sid, "Attendance", organization_id="org_a", date="2026-10-07",
        student_id="stu_1", student_name="Anbarasu", session_name="Morning",
        status="Present", remarks="", marked_by="Coach",
    )
    client.mark_attendance(
        sid, "Attendance", organization_id="org_a", date="2026-10-07",
        student_id="stu_1", student_name="Anbarasu", session_name="Evening",
        status="Absent", remarks="", marked_by="Coach",
    )

    rows = client.read_all_rows(sid, "Attendance")
    assert len(rows) == 2


def test_different_students_same_day_are_separate_rows(monkeypatch):
    drive_world, sheets_store = {}, {}
    patch_google_apis(monkeypatch, drive_world, sheets_store)
    client = SheetsClient(credentials=None)
    sid = client.ensure_spreadsheet("Attendance", "Attendance")

    for student_id in ("stu_1", "stu_2"):
        client.mark_attendance(
            sid, "Attendance", organization_id="org_a", date="2026-10-07",
            student_id=student_id, student_name=student_id, session_name="Morning",
            status="Present", remarks="", marked_by="Coach",
        )

    assert len(client.read_all_rows(sid, "Attendance")) == 2
