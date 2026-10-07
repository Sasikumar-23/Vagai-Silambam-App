from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_tenant_guc(db: Session, organization_id: str) -> None:
    """
    Second line of defence. PostgreSQL row-level security policies read
    ``app.current_org``; if a query ever forgets its organization filter the
    database still refuses to return another tenant's rows. No-op on SQLite,
    which is only used by the test suite.
    """
    if db.bind.dialect.name != "postgresql":
        return
    db.execute(text("SELECT set_config('app.current_org', :org, true)"), {"org": organization_id})
