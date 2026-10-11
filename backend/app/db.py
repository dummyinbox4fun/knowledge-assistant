"""Postgres connection handling.

One short-lived connection per call — no pool to manage or leak, which
fits this project's scale (single user, low concurrency, free-tier DB).
Each connection registers the pgvector type adapter so Python lists can
be written to and read from `vector` columns directly.
"""
from contextlib import contextmanager

from app.config import settings


@contextmanager
def get_cursor():
    import psycopg2
    from pgvector.psycopg2 import register_vector

    conn = psycopg2.connect(settings.database_url)
    register_vector(conn)
    try:
        with conn:
            with conn.cursor() as cur:
                yield cur
    finally:
        conn.close()