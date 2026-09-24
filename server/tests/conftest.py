import psycopg
import pytest
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app import db, settings

TEST_DB = "app72h_test"


@pytest.fixture(scope="session")
def test_database():
    """Fresh database for the test run (the compose Postgres user may create databases)."""
    admin = settings.DATABASE_URL
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    params = conninfo_to_dict(admin)
    params["dbname"] = TEST_DB
    settings.DATABASE_URL = make_conninfo(**params)
    db.reset()
    yield
    db.reset()
    settings.DATABASE_URL = admin
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")


@pytest.fixture
def clean_db(test_database):
    with db.pool().connection() as conn:
        conn.execute("TRUNCATE users, sessions, login_codes RESTART IDENTITY CASCADE")
    yield
