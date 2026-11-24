"""
Attendance's permanent home. Rows are addressed by (date, student_id, session_name)
so marking the same student twice for the same session updates in place instead of
creating a duplicate — the SaaS brief requires this explicitly.

Column layout (row 1 is the header, written once):
  attendance_id | date | student_id | student_name | session_name | status | remarks | marked_by | created_at | organization_id
"""

from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from ..models import new_id
from .retry import with_backoff

HEADER = [
    "attendance_id", "date", "student_id", "student_name", "session_name",
    "status", "remarks", "marked_by", "created_at", "organization_id",
]
SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"


class SheetsClient:
    def __init__(self, credentials: Credentials):
        self._sheets = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        self._drive = build("drive", "v3", credentials=credentials, cache_discovery=False)

    # ── provisioning ──────────────────────────────────────────────

    @with_backoff()
    def _find_spreadsheet(self, title: str) -> str | None:
        query = f"name = '{title}' and mimeType = '{SPREADSHEET_MIME}' and trashed = false"
        result = self._drive.files().list(q=query, fields="files(id)", pageSize=1).execute()
        files = result.get("files", [])
        return files[0]["id"] if files else None

    @with_backoff()
    def _create_spreadsheet(self, title: str, sheet_name: str) -> str:
        body = {"properties": {"title": title}, "sheets": [{"properties": {"title": sheet_name}}]}
        created = self._sheets.spreadsheets().create(body=body, fields="spreadsheetId").execute()
        return created["spreadsheetId"]

    @with_backoff()
    def _move_into_folder(self, file_id: str, folder_id: str) -> None:
        current = self._drive.files().get(fileId=file_id, fields="parents").execute()
        previous_parents = ",".join(current.get("parents", []))
        self._drive.files().update(
            fileId=file_id, addParents=folder_id, removeParents=previous_parents, fields="id"
        ).execute()

    def ensure_spreadsheet(self, title: str, sheet_name: str, folder_id: str | None = None) -> str:
        spreadsheet_id = self._find_spreadsheet(title)
        if spreadsheet_id is None:
            spreadsheet_id = self._create_spreadsheet(title, sheet_name)
            if folder_id:
                self._move_into_folder(spreadsheet_id, folder_id)
        self._ensure_header(spreadsheet_id, sheet_name)
        return spreadsheet_id

    @with_backoff()
    def _ensure_header(self, spreadsheet_id: str, sheet_name: str) -> None:
        existing = self._sheets.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=f"{sheet_name}!A1:J1"
        ).execute()
        if existing.get("values"):
            return
        self._sheets.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A1",
            valueInputOption="RAW",
            body={"values": [HEADER]},
        ).execute()

    # ── reads ─────────────────────────────────────────────────────

    @with_backoff()
    def read_all_rows(self, spreadsheet_id: str, sheet_name: str) -> list[dict]:
        result = self._sheets.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=f"{sheet_name}!A2:J"
        ).execute()
        rows = result.get("values", [])
        return [dict(zip(HEADER, row + [""] * (len(HEADER) - len(row)))) for row in rows]

    # ── writes ────────────────────────────────────────────────────

    def _find_existing(
        self, rows: list[dict], date: str, student_id: str, session_name: str
    ) -> tuple[int, dict] | None:
        """(sheet row number, row) of an existing mark for this student+date+session, if any."""
        for offset, row in enumerate(rows):
            if row["date"] == date and row["student_id"] == student_id and row["session_name"] == session_name:
                return offset + 2, row  # +1 for the header row, +1 for 1-indexing
        return None

    @with_backoff()
    def _write_row(self, spreadsheet_id: str, sheet_name: str, row_number: int, values: list[str]) -> None:
        self._sheets.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A{row_number}:J{row_number}",
            valueInputOption="RAW",
            body={"values": [values]},
        ).execute()

    @with_backoff()
    def _append_row(self, spreadsheet_id: str, sheet_name: str, values: list[str]) -> None:
        self._sheets.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A:J",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [values]},
        ).execute()

    @with_backoff()
    def _write_rows(self, spreadsheet_id: str, sheet_name: str, updates: list[tuple[int, list[str]]]) -> None:
        self._sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "valueInputOption": "RAW",
                "data": [
                    {"range": f"{sheet_name}!A{row}:J{row}", "values": [values]} for row, values in updates
                ],
            },
        ).execute()

    @with_backoff()
    def _append_rows(self, spreadsheet_id: str, sheet_name: str, rows: list[list[str]]) -> None:
        self._sheets.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A:J",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": rows},
        ).execute()

    def mark_attendance_batch(
        self, spreadsheet_id: str, sheet_name: str, *, organization_id: str, marked_by: str, records: list[dict]
    ) -> int:
        """Upserts a whole session: one read, then at most one update call and one append call,
        so a batch of students never runs into the Sheets per-minute write quota."""
        rows = self.read_all_rows(spreadsheet_id, sheet_name)
        now = datetime.now(timezone.utc).isoformat()
        existing = {
            (row["organization_id"], row["date"], row["student_id"], row["session_name"]): (offset + 2, row)
            for offset, row in enumerate(rows)
        }
        updates: list[tuple[int, list[str]]] = []
        appends: list[list[str]] = []
        pending_new: dict[tuple, int] = {}  # the same student twice in one batch: last mark wins
        for rec in records:
            key = (organization_id, rec["date"], rec["student_id"], rec["session_name"])
            found = existing.get(key)
            attendance_id = found[1]["attendance_id"] if found else new_id("att")
            values = [attendance_id, rec["date"], rec["student_id"], rec["student_name"], rec["session_name"],
                      rec["status"], rec.get("remarks") or "", marked_by, now, organization_id]
            if found is not None:
                updates.append((found[0], values))
            elif key in pending_new:
                values[0] = appends[pending_new[key]][0]
                appends[pending_new[key]] = values
            else:
                pending_new[key] = len(appends)
                appends.append(values)
        if updates:
            self._write_rows(spreadsheet_id, sheet_name, updates)
        if appends:
            self._append_rows(spreadsheet_id, sheet_name, appends)
        return len(records)

    def mark_attendance(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        *,
        organization_id: str,
        date: str,
        student_id: str,
        student_name: str,
        session_name: str,
        status: str,
        remarks: str,
        marked_by: str,
    ) -> str:
        """Upserts one attendance row (single read + single write). Returns the attendance_id."""
        rows = self.read_all_rows(spreadsheet_id, sheet_name)
        found = self._find_existing(rows, date, student_id, session_name)
        now = datetime.now(timezone.utc).isoformat()

        attendance_id = found[1]["attendance_id"] if found else new_id("att")
        values = [attendance_id, date, student_id, student_name, session_name, status, remarks, marked_by, now, organization_id]

        if found is not None:
            self._write_row(spreadsheet_id, sheet_name, found[0], values)
        else:
            self._append_row(spreadsheet_id, sheet_name, values)

        return attendance_id
