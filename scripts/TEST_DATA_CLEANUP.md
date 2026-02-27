# Test / Development Data Cleanup

This document lists where test and development data lives and how to clean it **after you confirm** each step. Nothing is deleted automatically.

---

## 1. PostgreSQL database (development)

- **Where:** The database pointed to by `backend/.env` → `DATABASE_URL` (default: `postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker`).
- **Used by:** The running app (dev) and integration tests (same URL). There is no separate test database.
- **Tables:** `users`, `routes`, `photos`, `route_photos`, `route_tags`, `tags`.

**Inspect current data (run from repo root):**

```bash
cd backend && source .venv/bin/activate 2>/dev/null; python3 -c "
import asyncio, os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
async def counts():
    url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker')
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        for t in ['users', 'routes', 'photos', 'route_photos', 'route_tags', 'tags']:
            r = await conn.execute(text('SELECT COUNT(*) FROM ' + t))
            print(t + ':', r.scalar())
    await engine.dispose()
asyncio.run(counts())
"
```

**Clean database (only after you confirm):** Run the script below with `--confirm` when you are ready to wipe all app data (users, routes, photos, etc.) from this DB:

```bash
./scripts/cleanup_dev_data.sh --confirm
```

Or manually with SQL (order respects foreign keys):

```sql
TRUNCATE route_photos, route_tags, photos, routes, users RESTART IDENTITY CASCADE;
TRUNCATE tags RESTART IDENTITY CASCADE;
```

---

## 2. Local uploads (photo files)

- **Where:** `backend/local_uploads/` (gitignored). Configured by `LOCAL_STORAGE_PATH` in `backend/.env` (e.g. `./local_uploads`).
- **Contents:** Photo files stored when S3 is not used (e.g. development). Structure: `photos/<user_id>/<photo_id>/original.jpg` and `thumbnail.jpg`.
- **Current state (as of this report):** 86 files under 3 user directories.

**Clean (only after you confirm):** Remove all files and directories under `backend/local_uploads/`:

```bash
rm -rf backend/local_uploads/*
```

Or, to remove the directory and let the app recreate it when needed:

```bash
rm -rf backend/local_uploads
```

**Important:** If you clean the database first, the app will no longer reference these files. If you clean files first, the DB will still have photo rows pointing at paths that no longer exist (broken thumbnails/originals until you clean the DB). Recommended: clean DB first, then local_uploads, or run `cleanup_dev_data.sh --confirm` which does both in that order.

---

## 3. E2E test fixture (kept; not visible to normal users)

- **Where:** `frontend/e2e/fixtures/photo-with-gps.jpg`
- **Purpose:** Used only by E2E upload test (`frontend/e2e/upload-photo.spec.ts`). Minimal JPEG with EXIF GPS.
- **Visibility:** The fixture file is **not** served to app users (e2e/ is not in the build or public assets). Keep it for E2E. Regenerate from repo root: `python3 backend/scripts/create_e2e_photo.py`
- **E2E-created data:** When E2E runs, it creates routes and photos in the same database as dev. Those records can appear in browse for normal users. To avoid that, run E2E against a dedicated test database (set `DATABASE_URL` to a separate DB when running E2E) or run `cleanup_dev_data.sh --confirm` after E2E.

---

## Summary

| Location                    | Purpose              | Clean action (after your confirmation)        |
|----------------------------|----------------------|-----------------------------------------------|
| PostgreSQL (DATABASE_URL)  | Dev + test app data  | TRUNCATE tables or run `cleanup_dev_data.sh --confirm` |
| backend/local_uploads/     | Dev photo files      | `rm -rf backend/local_uploads/*` (or directory) |
| frontend/e2e/fixtures/     | E2E only (not served)| Keep; regenerate with `create_e2e_photo.py` if deleted |

**No deletions have been performed.** Confirm what you want cleaned, then run the commands above or the script with `--confirm`.
