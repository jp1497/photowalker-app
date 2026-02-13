"""Issue a Bearer token for manual API testing (e.g. Swagger UI, curl).

Requires: backend venv activated, .env with DATABASE_URL and SECRET_KEY (same as running app).
Run from backend/: python scripts/issue_dev_token.py

Creates a one-off user and prints the access token. Use in Authorization header as:
  Authorization: Bearer <token>
"""
from __future__ import annotations

import asyncio
import os
import sys
from uuid import uuid4

# Add backend to path so 'app' is importable when run from repo root or backend/
_scripts_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_scripts_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from app.core.config import get_settings
from app.db.session import create_engine, create_session_factory
from app.models.user import User
from app.services.auth_service import issue_tokens


async def main() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    uid = uuid4().hex[:8]
    async with session_factory() as session:
        user = User(
            google_id=f"dev-token-{uid}",
            email=f"dev-{uid}@localhost",
            name="Dev Token User",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        access_token, _ = issue_tokens(settings, user.id)
        print("Access token (use in Authorization: Bearer <token>):")
        print(access_token)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())