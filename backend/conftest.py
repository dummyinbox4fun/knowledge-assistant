import os
os.environ.setdefault("ENVIRONMENT", "test")
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("ENVIRONMENT", "test")

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/postgres"
)


@pytest.fixture(autouse=True)
def isolate_database(monkeypatch):
    """Point every test at the local Docker test database, never the real
    Supabase database configured in .env for manual/live use.

    Truncates documents (which cascades to chunks via the foreign key)
    before and after each test, so tests don't leak data into each other
    or into whatever was left over from a previous run.
    """
    from app import db
    from app.config import settings

    monkeypatch.setattr(settings, "database_url", TEST_DATABASE_URL)

    with db.get_cursor() as cur:
        cur.execute("TRUNCATE documents CASCADE")

    yield

    with db.get_cursor() as cur:
        cur.execute("TRUNCATE documents CASCADE")