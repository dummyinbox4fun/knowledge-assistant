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


@pytest.fixture(autouse=True)
def fake_login():
    """Treat every request in the API tests as coming from a signed-in test user.

    The real login check is tested in test_auth.py and test_auth_jwt.py;
    test_auth.py switches this stand-in off.
    """
    from app.auth import AuthUser, require_auth
    from app.main import app

    app.dependency_overrides[require_auth] = lambda: AuthUser(
        id="00000000-0000-0000-0000-000000000001", email="test@example.com"
    )
    yield
    app.dependency_overrides.pop(require_auth, None)