"""Integration tests for Alembic migrations. Step 1.1 - v3 migrations, Definition of Done."""
import os
import subprocess
import sys

import sqlalchemy as sa

from tests.conftest import requires_postgres


def _sync_db_url() -> str:
    """Return DATABASE_URL with psycopg2 for sync engine (schema verification)."""
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
    )
    return url.replace("postgresql+asyncpg", "postgresql+psycopg2")


def _verify_v3_columns() -> None:
    """Verify photos.location nullable and routes.is_draft exist after upgrade."""
    engine = sa.create_engine(_sync_db_url())
    with engine.connect() as conn:
        r = conn.execute(
            sa.text("""
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'location'
            """)
        )
        row = r.fetchone()
        assert row is not None, "photos.location column missing"
        assert row[0] == "YES", f"photos.location should be nullable, got {row[0]}"

        r2 = conn.execute(
            sa.text("""
                SELECT column_name, data_type FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'is_draft'
            """)
        )
        row2 = r2.fetchone()
        assert row2 is not None, "routes.is_draft column missing"
        assert row2[1] == "boolean", f"routes.is_draft should be boolean, got {row2[1]}"
    engine.dispose()


def _alembic(*args: str) -> subprocess.CompletedProcess:
    """Run alembic from backend directory with DATABASE_URL from env or default."""
    env = os.environ.copy()
    env.setdefault(
        "DATABASE_URL",
        "postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker",
    )
    backend_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    cmd = [sys.executable, "-m", "alembic", *args]
    return subprocess.run(
        cmd,
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


@requires_postgres
def test_alembic_upgrade_head_succeeds() -> None:
    """alembic upgrade head runs successfully against Postgres."""
    result = _alembic("upgrade", "head")
    assert result.returncode == 0, (
        f"alembic upgrade head failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )


@requires_postgres
def test_v3_migrations_verify_columns_exist() -> None:
    """Step 1.1: Verify photos.location nullable and routes.is_draft exist after upgrade."""
    _alembic("upgrade", "head")
    _verify_v3_columns()


@requires_postgres
def test_alembic_downgrade_minus_one_succeeds() -> None:
    """alembic downgrade -1 runs successfully (after upgrade head)."""
    # Ensure we're at head first (idempotent).
    _alembic("upgrade", "head")
    result = _alembic("downgrade", "-1")
    assert result.returncode == 0, (
        f"alembic downgrade -1 failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )


@requires_postgres
def test_alembic_upgrade_after_downgrade_restores_schema() -> None:
    """After downgrade -1, upgrade head restores tables (leave DB usable)."""
    _alembic("downgrade", "-1")
    result = _alembic("upgrade", "head")
    assert result.returncode == 0, (
        f"alembic upgrade head after downgrade failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )
