"""
Thin wrapper over the Drive v3 API. PostgreSQL stores only file metadata
(`drive_files`); the actual bytes always stay in the organization's own Drive.
"""

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .retry import with_backoff

FOLDER_MIME = "application/vnd.google-apps.folder"

# Subfolders every organization gets under its root "Vagai Silambam" folder.
SUBFOLDERS = ["Student Photos", "Certificates", "Student Documents", "Event Documents", "Other Files"]


class DriveClient:
    def __init__(self, credentials: Credentials):
        self._service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    @with_backoff()
    def _find_folder(self, name: str, parent_id: str | None) -> str | None:
        parent_clause = f" and '{parent_id}' in parents" if parent_id else ""
        query = f"name = '{name}' and mimeType = '{FOLDER_MIME}' and trashed = false{parent_clause}"
        result = self._service.files().list(q=query, fields="files(id)", pageSize=1).execute()
        files = result.get("files", [])
        return files[0]["id"] if files else None

    @with_backoff()
    def _create_folder(self, name: str, parent_id: str | None) -> str:
        metadata = {"name": name, "mimeType": FOLDER_MIME}
        if parent_id:
            metadata["parents"] = [parent_id]
        created = self._service.files().create(body=metadata, fields="id").execute()
        return created["id"]

    def ensure_folder(self, name: str, parent_id: str | None = None) -> str:
        """Idempotent: a second call for the same org finds the existing folder."""
        return self._find_folder(name, parent_id) or self._create_folder(name, parent_id)

    def provision_organization_folders(self, organization_name: str) -> dict[str, str]:
        """
        Creates all 5 subfolders from the brief, but only 3 ids are returned for
        GoogleConnection to persist — those are the ones uploads need immediately
        (photos, certificates, documents). "Event Documents" and "Other Files"
        still exist in Drive; code that needs their id later can call
        `ensure_folder(name, root_id)` again, which is idempotent and finds them
        by name rather than requiring two more database columns today.
        """
        root_id = self.ensure_folder(f"Vagai Silambam - {organization_name}")
        subfolder_ids = {name: self.ensure_folder(name, root_id) for name in SUBFOLDERS}
        return {
            "root_folder_id": root_id,
            "photos_folder_id": subfolder_ids["Student Photos"],
            "certificates_folder_id": subfolder_ids["Certificates"],
            "documents_folder_id": subfolder_ids["Student Documents"],
        }

    @with_backoff()
    def upload_file(self, folder_id: str, filename: str, data: bytes, mime_type: str) -> str:
        from googleapiclient.http import MediaInMemoryUpload

        media = MediaInMemoryUpload(data, mimetype=mime_type, resumable=False)
        metadata = {"name": filename, "parents": [folder_id]}
        created = self._service.files().create(body=metadata, media_body=media, fields="id").execute()
        return created["id"]

    @with_backoff()
    def delete_file(self, file_id: str) -> None:
        self._service.files().delete(fileId=file_id).execute()
