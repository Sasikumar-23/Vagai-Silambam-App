"""
Create tables and seed the plan catalogue for local development.

PostgreSQL is the production database; point DATABASE_URL at a local SQLite file
when you just want to click through the web app without installing PostgreSQL:

    DATABASE_URL=sqlite:///./dev.db python scripts/dev_bootstrap.py
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app import models  # noqa: F401,E402  (import registers the tables)
from app.seed_plans import seed_plans  # noqa: E402

Base.metadata.create_all(engine)

with SessionLocal() as session:
    seed_plans(session)

print(f"Schema ready and plans seeded on {engine.url}")
