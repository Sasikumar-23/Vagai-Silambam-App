"""
In-memory stand-ins for the Google Drive and Sheets APIs, shaped closely enough to
the real `googleapiclient` call chains (`.files().list().execute()`, etc.) that
`google_drive.DriveClient` and `google_sheets.SheetsClient` can run against them
unmodified. There is no live Google account available in this environment, so this
is what makes the integration logic (folder provisioning, row upsert, retry)
testable at all — it does not substitute for a real end-to-end check.
"""

from googleapiclient.errors import HttpError

FOLDER_MIME = "application/vnd.google-apps.folder"
SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"


class FakeHttpResponse:
    def __init__(self, status: int):
        self.status = status
        self.reason = "error"


def make_http_error(status: int) -> HttpError:
    return HttpError(FakeHttpResponse(status), b"{}")


class FakeExecutable:
    """Wraps a zero-arg callable so `.execute()` matches the real client's shape."""

    def __init__(self, fn):
        self._fn = fn

    def execute(self):
        return self._fn()


class FlakyExecutable:
    """Fails with the given HTTP status N times, then succeeds. For retry tests."""

    def __init__(self, fn, fail_times: int, status: int):
        self._fn = fn
        self._fail_times = fail_times
        self._status = status
        self.calls = 0

    def execute(self):
        self.calls += 1
        if self.calls <= self._fail_times:
            raise make_http_error(self._status)
        return self._fn()


class FakeDriveFiles:
    def __init__(self, world: dict):
        self.world = world  # {file_id: {"name", "mimeType", "parents": [..]}}

    def list(self, q: str, fields: str = "", pageSize: int = 10):
        name = q.split("name = '")[1].split("'")[0]
        mime = q.split("mimeType = '")[1].split("'")[0]
        parent = None
        if "' in parents" in q:
            parent = q.split("and '")[1].split("'")[0]

        matches = [
            {"id": fid}
            for fid, meta in self.world.items()
            if meta["name"] == name
            and meta["mimeType"] == mime
            and not meta.get("trashed")
            and (parent is None or parent in meta.get("parents", []))
        ]
        return FakeExecutable(lambda: {"files": matches})

    def create(self, body: dict, fields: str = "", media_body=None):
        file_id = f"file_{len(self.world) + 1}"

        def _create():
            self.world[file_id] = {
                "name": body["name"],
                "mimeType": body.get("mimeType", "application/octet-stream"),
                "parents": body.get("parents", []),
                "media": media_body,
            }
            return {"id": file_id}

        return FakeExecutable(_create)

    def update(self, fileId: str, addParents: str = "", removeParents: str = "", fields: str = ""):
        def _update():
            meta = self.world[fileId]
            parents = set(meta.get("parents", []))
            if removeParents:
                parents -= set(removeParents.split(","))
            if addParents:
                parents.add(addParents)
            meta["parents"] = list(parents)
            return {"id": fileId}

        return FakeExecutable(_update)

    def get(self, fileId: str, fields: str = ""):
        return FakeExecutable(lambda: {"parents": self.world[fileId].get("parents", [])})

    def delete(self, fileId: str):
        def _delete():
            self.world.pop(fileId, None)
            return {}

        return FakeExecutable(_delete)


class FakeDriveService:
    def __init__(self, world: dict | None = None):
        self.world = world if world is not None else {}

    def files(self) -> FakeDriveFiles:
        return FakeDriveFiles(self.world)


class FakeSheetsValues:
    def __init__(self, sheets: dict):
        self.sheets = sheets  # {spreadsheet_id: {sheet_name: [[row]...]}}

    def get(self, spreadsheetId: str, range: str):
        sheet_name = range.split("!")[0]
        rows = self.sheets.get(spreadsheetId, {}).get(sheet_name, [])
        start_row = 1 if range.split("!")[1].startswith("A1") else 2
        return FakeExecutable(lambda: {"values": [list(r) for r in rows[start_row - 1 :]]})

    def update(self, spreadsheetId: str, range: str, valueInputOption: str, body: dict):
        sheet_name = range.split("!")[0]
        cell = range.split("!")[1]
        row_number = int("".join(ch for ch in cell.split(":")[0] if ch.isdigit()))

        def _update():
            grid = self.sheets.setdefault(spreadsheetId, {}).setdefault(sheet_name, [])
            while len(grid) < row_number:
                grid.append([])
            grid[row_number - 1] = list(body["values"][0])
            return {"updatedRows": 1}

        return FakeExecutable(_update)

    def append(self, spreadsheetId: str, range: str, valueInputOption: str, insertDataOption: str, body: dict):
        sheet_name = range.split("!")[0]

        def _append():
            grid = self.sheets.setdefault(spreadsheetId, {}).setdefault(sheet_name, [])
            grid.append(list(body["values"][0]))
            return {"updates": {"updatedRows": 1}}

        return FakeExecutable(_append)


class FakeSpreadsheets:
    def __init__(self, sheets: dict, drive_world: dict):
        self.sheets = sheets
        self.drive_world = drive_world

    def values(self) -> FakeSheetsValues:
        return FakeSheetsValues(self.sheets)

    def create(self, body: dict, fields: str = ""):
        spreadsheet_id = f"sheet_{len(self.sheets) + 1}"

        def _create():
            title = body["properties"]["title"]
            self.drive_world[spreadsheet_id] = {"name": title, "mimeType": SPREADSHEET_MIME, "parents": []}
            self.sheets[spreadsheet_id] = {
                s["properties"]["title"]: [] for s in body.get("sheets", [])
            }
            return {"spreadsheetId": spreadsheet_id}

        return FakeExecutable(_create)


class FakeSheetsService:
    """Backed by the SAME drive_world as a FakeDriveService, since real Sheets
    files are also Drive files (search-by-name and move-into-folder rely on this)."""

    def __init__(self, drive_world: dict, sheets: dict | None = None):
        self.drive_world = drive_world
        self.sheets = sheets if sheets is not None else {}

    def spreadsheets(self) -> FakeSpreadsheets:
        return FakeSpreadsheets(self.sheets, self.drive_world)


def patch_google_apis(monkeypatch, drive_world: dict, sheets_store: dict) -> None:
    """
    Points DriveClient and SheetsClient at the fakes above. A single shared
    `drive_world` matters: Sheets files are Drive files too, so folder search,
    spreadsheet search and "move into folder" must all see one consistent world,
    exactly as they would against the real APIs.
    """

    def fake_build(service_name, version, credentials=None, cache_discovery=False, **kwargs):
        if service_name == "drive":
            return FakeDriveService(drive_world)
        if service_name == "sheets":
            return FakeSheetsService(drive_world, sheets_store)
        raise ValueError(f"no fake registered for {service_name}")

    monkeypatch.setattr("app.integrations.google_drive.build", fake_build)
    monkeypatch.setattr("app.integrations.google_sheets.build", fake_build)
