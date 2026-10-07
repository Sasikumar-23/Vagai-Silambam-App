"""
Tests run against SQLite for speed and because no PostgreSQL instance is available
in this environment. Application-level tenant isolation is fully exercised here.
PostgreSQL row-level security (the second line of defence) can only be verified
against a real PostgreSQL server — see TEST_REPORT.md.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-32b")
os.environ.setdefault("APP_ENV", "test")
# Fixed per test run so tests can be read deterministically; never used outside tests.
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "KaUefbWKp0rfKKSvjGY-ZrpxBD3tDyYjt1SPmv0EIhI=")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/google/callback")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed_plans import seed_plans  # noqa: E402


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    seed_plans(session)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_org(client):
    """Registers an organization and returns its tokens and headers."""

    def _make(name: str, username: str) -> dict:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "organization_name": name,
                "full_name_en": f"{name} Owner",
                "email": f"{username}@example.com",
                "username": username,
                "password": "StrongPassw0rd!",
            },
        )
        assert response.status_code == 201, response.text
        token = response.json()["access_token"]
        return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}

    return _make
