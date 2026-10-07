from datetime import datetime, timezone


def as_utc(value: datetime | None) -> datetime | None:
    """
    PostgreSQL returns timezone-aware timestamps; SQLite (used by the tests) returns
    naive ones. Normalise before comparing, otherwise the comparison raises.
    """
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
