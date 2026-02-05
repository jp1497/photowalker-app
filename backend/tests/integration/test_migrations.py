"""Integration tests for Alembic migrations. Step 1.3 - Definition of Done."""
import os
import subprocess
import sys

from tests.conftest import requires_postgres


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
