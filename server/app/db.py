"""PostgreSQL access: one small connection pool + append-only migrations applied on first use."""

import threading

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import settings

# Append-only: never edit a shipped migration, add a new one.
MIGRATIONS: list[str] = [
    # 1: accounts + email login codes
    """
    CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE sessions (
        token_hash bytea PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX sessions_user_idx ON sessions(user_id);
    CREATE TABLE login_codes (
        id bigserial PRIMARY KEY,
        email text NOT NULL,
        code_hash bytea NOT NULL,
        attempts int NOT NULL DEFAULT 0,
        used boolean NOT NULL DEFAULT false,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX login_codes_email_idx ON login_codes(email, created_at);
    """,
]

_pool: ConnectionPool | None = None
_lock = threading.Lock()


def pool() -> ConnectionPool:
    global _pool
    with _lock:
        if _pool is None:
            _pool = ConnectionPool(
                settings.DATABASE_URL, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True
            )
            migrate(_pool)
        return _pool


def reset() -> None:
    """Close the pool (tests switch databases)."""
    global _pool
    with _lock:
        if _pool is not None:
            _pool.close()
            _pool = None


def migrate(p: ConnectionPool) -> None:
    with p.connection() as conn:
        # Advisory lock: several workers starting at once apply migrations only once.
        conn.execute("SELECT pg_advisory_xact_lock(7272)")
        conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version int NOT NULL)")
        row = conn.execute("SELECT max(version) AS v FROM schema_version").fetchone()
        current = row["v"] or 0
        for version, sql in enumerate(MIGRATIONS[current:], start=current + 1):
            conn.execute(sql)
            conn.execute("INSERT INTO schema_version (version) VALUES (%s)", (version,))
