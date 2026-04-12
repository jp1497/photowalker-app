# Photowalker

Photo-based walking route app. Users upload geotagged photos to create routes; routes are browsable on a map.

**Stack:** FastAPI + SQLAlchemy 2 async + PostgreSQL/PostGIS + RQ worker + S3 | React 19 + TypeScript + MapLibre GL + Zustand + Axios

API reference: @shared/openapi.yaml (static copy; live canonical spec at `/openapi.json`)

---

## Commands

```bash
make dev-infra      # docker compose up -d (postgres, redis, backend container, thumbnail worker)
make dev-backend    # uvicorn --reload at localhost:8000 — use instead of backend container for hot reload
make dev-frontend   # vite dev server at localhost:5173
make test           # pytest (backend) + vitest run (frontend)
make test-e2e       # playwright — requires infra + backend running
make migrate        # alembic upgrade head via docker exec
make down           # docker compose down
```

Swagger UI (dev only): http://localhost:8000/docs

---

## File Structure

### Backend (`backend/app/`)

| Path | Purpose |
|---|---|
| `api/v1/auth.py` | Auth endpoints: Google OAuth, JWT issue/refresh, logout, `/auth/me`, E2E test-login |
| `api/v1/discovery.py` | `GET /v1/routes` — public browse with bbox/tag/author filters and pagination |
| `api/v1/routes.py` | Route CRUD: create, get by slug, update, delete, `POST /from-photos` |
| `api/v1/photos.py` | Photo upload, get, update (patch location/caption), delete, photos-in-bbox |
| `api/v1/health.py` | `/health`, `/health/db`, `/health/storage` |
| `auth/dependencies.py` | `get_current_user` (optional), `get_current_user_required` (raises 401) |
| `auth/jwt.py` | JWT encode/decode using `SECRET_KEY` |
| `auth/oauth.py` | Google OAuth token exchange |
| `core/config.py` | `Settings` (Pydantic BaseSettings), `get_settings()` via `@lru_cache` |
| `core/factory.py` | `create_app(settings)` — wires middleware, routers, DB engine |
| `core/exceptions.py` | Domain exceptions: `RouteNotFoundError`, `RouteForbiddenError`, `PhotoNotFoundError`, etc. |
| `db/session.py` | `create_engine()`, `create_session_factory()` |
| `db/dependencies.py` | `get_db` — FastAPI dependency yielding `AsyncSession` |
| `middleware/rate_limit.py` | `RateLimitMiddleware` — per-IP and per-user rate limits |
| `middleware/error_handler.py` | Maps domain exceptions to HTTP responses |
| `models/` | SQLAlchemy ORM: `User`, `Route`, `Photo`, `RoutePhoto`, `Tag`, `RouteTag` |
| `schemas/` | Pydantic v2 request/response models: `auth.py`, `photo.py`, `route.py`, `user.py` |
| `services/auth_service.py` | User lookup/create from Google token |
| `services/route_service.py` | Route create/update/delete, geometry validation, slug generation |
| `services/photo_service.py` | Photo create/update/delete, EXIF extraction, bbox query |
| `services/discovery_service.py` | Browse/filter/paginate public routes |
| `storage/s3.py` | S3 upload/download/delete + local filesystem fallback for dev |
| `utils/exif.py` | Extract GPS and timestamp from EXIF |
| `utils/geometry.py` | GeoJSON validation, linestring distance (`distance_meters`), bbox helpers |
| `utils/slug.py` | `generate_slug()`, `ensure_unique_slug_async()` |
| `utils/thumbnail.py` | PIL resize to thumbnail |
| `workers/thumbnail_job.py` | RQ job: download original → resize → upload thumbnail → update DB |

### Frontend (`frontend/src/`)

| Path | Purpose |
|---|---|
| `api/client.ts` | Axios instance with Bearer token injection and 401→refresh interceptor |
| `api/auth.ts` | `login()`, `logout()`, `refresh()`, `getMe()` |
| `api/routes.ts` | Route CRUD API calls |
| `api/photos.ts` | Photo upload, update, delete, bbox fetch |
| `store/authStore.ts` | Zustand: `user`, `accessToken`, `loading`, `setUser`, `clearUser` |
| `store/toastStore.ts` | Zustand: toast queue with `add(message, type)` |
| `hooks/useAuth.ts` | Session bootstrap on mount (singleton `initPromise`), `login()`, `logout()` |
| `hooks/useFocusTrap.ts` | Accessibility: trap keyboard focus within a container |
| `hooks/usePreferredMapCenter.ts` | Map center from user settings or IP geolocation |
| `contexts/MapContext.tsx` | Shares MapLibre `Map` instance across the component tree |
| `contexts/HighlightedRouteContext.tsx` | Shares highlighted route slug + layer-ready flag |
| `contexts/RoutesPanelContext.tsx` | Controls routes panel open/close state |
| `components/common/` | `Button`, `Input`, `Loading`, `Toast`, `BottomDrawer`, `AccountIcon`, `DrawerMenu`, `ErrorBoundary`, `ProtectedRoute`, `OverlayCard`, `WelcomeModal` |
| `components/map/MapShell.tsx` | Root map layout; sets mode (`home`/`browse-photos`/`create`/`detail`) |
| `components/map/MapView.tsx` | MapLibre GL canvas mount and style load |
| `components/map/MapPicker.tsx` | Single-point coordinate picker on map |
| `components/map/RouteDrawer.tsx` | MapLibre GL Draw wrapper for polyline drawing |
| `components/map/HighlightedRouteLayer.tsx` | Renders highlighted route polyline on map |
| `components/map/PhotoMarker.tsx` | Thumbnail pin marker element |
| `components/explore/ExploreRoutesPanel.tsx` | Side panel: route list, All/My filter, hover highlight |
| `components/photos/PhotoUploadForm.tsx` | File input, caption, upload progress, EXIF preview |
| `components/photos/PhotoGallery.tsx` | Scrollable photo grid with lightbox |
| `components/routes/RouteForm.tsx` | Title/description/tags/visibility fields |
| `components/routes/RouteView.tsx` | Route detail display: map polyline + photo list |
| `pages/Browse.tsx` | Main browse page: photo pins in bbox, cluster markers, lightbox (~958 lines — complex) |
| `pages/RouteDetail.tsx` | Route detail in BottomDrawer; editable photo locations |
| `pages/CreateRouteFromPhotos.tsx` | Multi-step: upload photos → reorder → publish |
| `pages/CreateRoute.tsx` | Draw-first route creation flow |
| `pages/AuthCallback.tsx` | Handles `/auth/callback` redirect from Google OAuth |
| `pages/Settings.tsx` | Stub — placeholder only |
| `types/route.ts` | `Route`, `RouteCreatePayload`, `RouteFromPhotosPayload`, `BrowseResponse`, etc. |
| `types/photo.ts` | `Photo` type |
| `types/api.ts` | `User` type, shared API types |
| `map/mapStyles.ts` | MapLibre style config |
| `map/poiConfig.ts` | POI layer config |
| `utils/geometry.ts` | Client-side geometry helpers |
| `utils/validation.ts` | Input validation helpers |

---

## Backend Architecture

### Application Factory

`create_app(settings: Settings) -> FastAPI` in `core/factory.py`. All middleware and routers are registered there. Router registration order matters: `discovery.router` must come before `routes.router` so `GET /v1/routes` (browse) is not consumed by the `/{slug}` param route.

### Config

`Settings` extends Pydantic `BaseSettings`. Retrieved via `get_settings()` which is `@lru_cache`'d — one instance per process. Loaded from `backend/.env`. Inject into endpoints via `Depends(get_settings)` or import `get_settings()` directly in workers.

### Database Sessions

Async SQLAlchemy via `asyncpg`. The `get_db` dependency (`db/dependencies.py`) yields an `AsyncSession` per request.

**Rule: commit in the API layer (router), not inside services.** Services call `db.flush()` for within-transaction visibility; the router calls `await db.commit()` after the service succeeds. This keeps transaction boundaries explicit.

```python
# Router (correct)
route = await route_service.create_route(db, user_id, body)
await db.commit()

# Service (correct — flush only)
db.add(route)
await db.flush()
await db.refresh(route)
```

Eager-load related data with `selectinload` at query time rather than triggering lazy loads (async sessions do not support lazy loading).

### Auth Dependencies

- `get_current_user` — returns `User | None`; use for endpoints that behave differently when authenticated
- `get_current_user_required` — raises `HTTPException(401)` if no valid token; use for protected endpoints

JWT access token (15 min, Bearer header). Refresh token in HTTP-only cookie (7 days).

### Services Layer

Business logic only. Services receive `AsyncSession` as first argument and return ORM model instances. Rules:

- **Do not import from `schemas/`** inside services — move any shared helpers to `utils/`
- **Do not commit** — only flush for within-transaction visibility
- Raise domain exceptions from `core/exceptions.py` (e.g. `RouteNotFoundError`); the error handler middleware maps these to HTTP responses

### Schemas (Pydantic v2)

- Use `model_config = ConfigDict(from_attributes=True)` on response schemas
- ORM → schema: `RouteResponse.model_validate(orm_obj)`
- Schema → dict for response: `schema.model_dump(mode="json", by_alias=True)`
- GeoAlchemy2 geometry fields need manual conversion: `geoalchemy2.shape.to_shape()` → `shapely.geometry.mapping()`

### Error Handling

Raise `HTTPException` in routers for input/auth errors. Raise domain exceptions from `core/exceptions.py` in services — `error_handler.py` maps them. Error response body shape: `{"code": "...", "message": "...", "details": null}`.

### Rate Limiting

`RateLimitMiddleware` applies globally: 100 req/min anon, 500 req/min authenticated, 10 photo uploads/min, 5 routes/hour. In-memory store (per-process) — fine for single-worker dev; Redis required in production.

---

## Frontend Architecture

### API Client

All API calls go through `apiClient` from `src/api/client.ts` (Axios). Never use raw `fetch`. The client:
- Injects `Authorization: Bearer <token>` from `authStore`
- On 401: pauses the request, calls `refresh()`, retries with new token, redirects to `/login` if refresh fails
- On 5xx/network error: auto-shows a toast

### State Management

Two Zustand stores:
- `authStore` — `user`, `accessToken`, `loading`. Call `authStore.getState()` outside React components
- `toastStore` — `toastStore.getState().add(message, 'error' | 'success' | 'info')` to show toasts from anywhere

### Auth Flow

`useAuth()` runs once on app mount via a module-level `initPromise` singleton: calls `refresh()` → `getMe()` → populates `authStore`. Skips init on `/auth/callback` and `/login` paths. `<ProtectedRoute>` redirects unauthenticated users to `/login`.

Use `useAuth()` to get `{ user, loading, login, logout, isAuthenticated }`. Do not read `authStore` directly in components for auth checks — use the hook.

### Map

`MapShell` is the root layout for all map-enabled routes. It derives `mode` from the pathname:

| Pathname | Mode |
|---|---|
| `/browse` | `browse-photos` |
| `/routes/create` | `create` |
| `/routes/:slug` | `detail` |
| `/` | `home` |

`MapContext` shares the MapLibre `Map` instance. Access via `useContext(MapContext)`. Map tiles come from OpenFreeMap (no API key required).

### Routing

`App.tsx` defines all routes. `MapShellLayout` wraps everything except `/auth/callback` and `*`. Navigate to route detail with `navigate('/routes/:slug', { state: { openDrawer: true, preserveViewport: true } })` to keep the map viewport.

### Toasts

```ts
import { toastStore } from '../store/toastStore';
toastStore.getState().add('Something went wrong', 'error');
```

---

## Code Style

### Backend (Python)

- `from __future__ import annotations` at the top of every module (enables forward references, PEP 563)
- Type hints on all function signatures; use `Optional[T]` (not `T | None`) for Python 3.9 compat
- Async throughout: `async def` endpoints and services, `await` all DB calls
- Structured JSON logging via `python-json-logger` — use `logging.getLogger(__name__)`, not `print`
- Pydantic v2 (`BaseModel`, `Field`, `@field_validator`, `model_config`) — not v1 API
- `from __future__ import annotations` allows string-based forward refs in type hints without quotes

### Frontend (TypeScript)

- Functional components with hooks only — no class components
- Named exports throughout (e.g. `export function Browse()`) — not default exports, except `App`
- `import type` for type-only imports
- Inline styles for component-level styling; no CSS framework
- All async call sites need `.catch()` or `try/catch` — unhandled rejections are a known gap
- Touch targets must be ≥44px (WCAG 2.1)
- Coordinates are always `[longitude, latitude]` (GeoJSON order), not `[lat, lon]`

---

## Testing

### Backend

```bash
cd backend && pytest                      # unit tests — no Postgres needed
cd backend && pytest tests/integration/   # requires running photowalker_test DB
cd backend && pytest --tb=short -q        # concise output (same as make test)
```

- Tests marked `@requires_postgres` are silently skipped in the unit run — this is by design
- When mocking `AsyncSession`: `session.add` is synchronous in SQLAlchemy — use `MagicMock()` for it, not `AsyncMock`
- Dev DB: `photowalker` | Test DB: `photowalker_test`

### Frontend

```bash
cd frontend && npm run test         # vitest run (jsdom)
cd frontend && npm run test:watch   # watch mode
cd frontend && npm run test:e2e     # playwright (needs infra + backend)
```

- Map canvas is not available in jsdom — mock `MapContext` in any test touching map components
- Wrap async state updates in `waitFor(() => ...)` to avoid `act()` warnings
- E2E auth bypasses Google OAuth via `POST /v1/auth/test-login` with `X-E2E-Secret` header — only works when `E2E_TEST_SECRET` is set in backend `.env`

---

## Dev Environment Quirks

- **Hot reload:** `docker compose stop backend` before `make dev-backend` — both bind port 8000
- **Port 5432 conflict:** `brew services stop postgresql` or remap postgres port in `docker-compose.yml` and update `DATABASE_URL`
- **Apple Silicon:** PostGIS runs under linux/amd64 emulation — platform warning is expected
- **Backend venv:** `backend/.venv/` — prefix commands with `backend/.venv/bin/` or activate first

## Known Gotchas

- `SECRET_KEY` has no min-length validation — a short key makes all JWTs forgeable (`core/config.py:26`)
- Health endpoints return `"error": str(e)` — do not add more of this pattern; log server-side only
- `@app.on_event` is deprecated — use `@asynccontextmanager` lifespan for any new startup/shutdown logic
- `test-login` endpoint is always included in OpenAPI — only register the router when `settings.e2e_test_secret is not None`
- `X-Forwarded-For` currently takes the rightmost IP (`split(",")[-1]`) — use `split(",")[0].strip()` in any new rate-limiting code
- `initPromise` in `useAuth` is module-level and persists across logout/re-login in the same session
