# Photowalker Implementation Roadmap

**Version:** 1.0  
**Date:** 2026-02-05  
**Design Reference:** [PRD v2](./PRD_v2.md)  
**Project Proposal:** [PROJECT_PROPOSAL](./PROJECT_PROPOSAL.md)

---

## Overview

This document defines a phased implementation plan for the Photowalker MVP. Each phase consists of discrete, committable steps. Every step includes:

- **Agent Instructions:** Clear requirements for the coding agent
- **Design Constraints:** Explicit references to PRD; no deviation without permission
- **Unit Tests:** Required test coverage
- **User Acceptance Tests (UAT):** Tests against user stories and acceptance criteria
- **Definition of Done:** Criteria that must be met before marking complete

---

## Design Authority

**Primary Reference:** [Design/PRD_v2.md](./PRD_v2.md)

**Agent Rule:** The coding agent MUST implement exactly what is specified in the PRD. Do NOT:
- Add features not in the PRD
- Change data models, API contracts, or schema without explicit permission
- Introduce new dependencies not listed in the PRD
- Deviate from the specified project structure

**Permission to Deviate:** If a technical constraint requires a design change, the agent MUST document the proposed change and stop. Do not implement alternatives without explicit approval.

---

## Phase Overview

| Phase | Name | Steps | Est. Commits |
|-------|------|-------|--------------|
| 0 | Project Foundation | 3 | 3 |
| 1 | Backend Foundation | 4 | 4 |
| 2 | Authentication | 3 | 3 |
| 3 | Routes | 4 | 4 |
| 4 | Photos | 5 | 5 |
| 5 | Discovery | 3 | 3 |
| 6 | Frontend | 6 | 6 |
| 7 | Integration & Polish | 4 | 4 |
| **Total** | | **32** | **32** |

---

## Phase 0: Project Foundation

**Goal:** Establish project scaffolding, development environment, and CI pipeline. No application logic.

---

### Step 0.1: Project Scaffolding

**Branch:** `main` (or `develop` if using git-flow)  
**Commit Message:** `chore: add project scaffolding (backend, frontend, design structure)`

#### Agent Instructions

1. Create directory structure per [PRD v2 - Project Structure](./PRD_v2.md#project-structure)
2. Backend: Create empty `backend/` with `app/` subdirectories: `core/`, `api/v1/`, `schemas/`, `services/`, `models/`, `db/`, `auth/`, `middleware/`, `storage/`, `utils/`, plus `alembic/`, `tests/`
3. Frontend: Create `frontend/` with Vite + React + TypeScript, structure per PRD
4. Add `__init__.py` to all Python packages
5. Create empty `requirements.txt`, `requirements-dev.txt`, `package.json` with correct dependencies from PRD
6. Ensure `Design/` folder exists with PRD and related docs
7. Update root `README.md` to reference Design docs and this roadmap

#### Design Constraints

- Follow [PRD v2 - Backend Structure](./PRD_v2.md#backend-structure-enhanced) exactly
- Follow [PRD v2 - Frontend Structure](./PRD_v2.md#frontend-structure) exactly
- Tech stack: FastAPI, React 18+, TypeScript, Vite per [PRD v2 - Technology Stack](./PRD_v2.md#appendix-technology-stack-summary)

#### Unit Tests

- N/A (no logic yet)

#### UAT

- N/A

#### Definition of Done

- [ ] Backend structure matches PRD
- [ ] Frontend structure matches PRD
- [ ] `pip install -r requirements.txt` succeeds
- [ ] `npm install` in frontend succeeds
- [ ] Backend runs: `uvicorn app.main:app` (will fail until Step 1.1, but import should not error)

---

### Step 0.2: Development Environment

**Branch:** `main`  
**Commit Message:** `chore: add docker-compose and environment configuration`

#### Agent Instructions

1. Create `docker-compose.yml` with:
   - PostgreSQL 15 + PostGIS 3.3
   - Redis (for thumbnail queue)
2. Create `backend/.env.example` with all variables from [PRD v2 - Environment Configuration](./PRD_v2.md#environment-configuration)
3. Create `frontend/.env.example` with `VITE_API_URL`
4. Add `.env` to `.gitignore` (verify not committed)
5. Document how to run `docker-compose up -d` and configure env in README

#### Design Constraints

- Database: PostgreSQL 15+ with PostGIS 3.3+ per PRD
- Redis for async jobs per PRD

#### Unit Tests

- N/A

#### UAT

- N/A

#### Definition of Done

- [ ] `docker-compose up -d` starts Postgres and Redis
- [ ] Postgres has PostGIS extension: `SELECT PostGIS_Version();` returns version
- [ ] `.env.example` documents all required variables

---

### Step 0.3: CI Pipeline Skeleton

**Branch:** `main`  
**Commit Message:** `ci: add GitHub Actions workflow skeleton`

#### Agent Instructions

1. Create `.github/workflows/ci.yml` per [PRD v2 - CI/CD Pipeline](./PRD_v2.md#cicd-pipeline)
2. Workflow runs on push/PR to `main`
3. Jobs: `lint` (ruff/flake8, mypy), `test` (pytest) — tests will fail until later phases
4. Use PostGIS service container for `test` job
5. Frontend: add `lint` (ESLint) and `test` (Vitest) jobs
6. Jobs should be runnable even if some steps fail (e.g., skip backend test if backend not yet implemented)

#### Design Constraints

- Per [PRD v2 - NFR6 Testing](./PRD_v2.md#nfr6-testing): tests run in CI on every PR

#### Unit Tests

- N/A (pipeline validates structure)

#### UAT

- N/A

#### Definition of Done

- [ ] Workflow file is valid YAML
- [ ] `lint` job runs (can be minimal initially)
- [ ] Workflow triggers on push to `main`

---

## Phase 1: Backend Foundation

**Goal:** Core FastAPI app, database layer, health checks. No business features.

---

### Step 1.1: Core Application Setup

**Branch:** `feat/core-app`  
**Commit Message:** `feat(backend): add core app with factory, config, middleware`

#### Agent Instructions

1. Implement `app/core/config.py` using Pydantic `BaseSettings` per [PRD v2 - Environment Configuration](./PRD_v2.md#environment-configuration)
2. Implement `app/core/factory.py` with `create_app(settings)` per [PRD v2 - Application Factory Pattern](./PRD_v2.md#application-factory-pattern)
3. Implement `app/middleware/error_handler.py` per [PRD v2 - Error Handling Middleware](./PRD_v2.md#error-handling-middleware)
4. Implement `app/main.py` that calls `create_app(get_settings())`
5. Configure CORS per [PRD v2 - CORS Configuration](./PRD_v2.md#cors-configuration)
6. Set `docs_url` and `redoc_url` based on `environment` per PRD
7. Add structured logging setup per [PRD v2 - Logging Strategy](./PRD_v2.md#logging-strategy)

#### Design Constraints

- Config: [PRD v2 - Settings class](./PRD_v2.md#environment-configuration)
- Factory: [PRD v2 - create_app](./PRD_v2.md#application-factory-pattern)
- Error format: [PRD v2 - Error Responses](./PRD_v2.md#error-responses)

#### Unit Tests

- `tests/unit/test_config.py`: Settings load from env, defaults correct
- `tests/unit/test_factory.py`: create_app returns FastAPI instance, docs disabled when env=production
- `tests/unit/test_error_handler.py`: ValidationError returns 400 with correct format, HTTPException returns correct status

#### UAT

- N/A (no user-facing features)

#### Definition of Done

- [ ] `uvicorn app.main:app` starts successfully
- [ ] `GET /docs` returns 200 in development
- [ ] Invalid JSON body returns 400 with `{"error": {"code": "VALIDATION_ERROR", ...}}`
- [ ] All unit tests pass

---

### Step 1.2: Database Layer and Models

**Branch:** `feat/core-app`  
**Commit Message:** `feat(backend): add database models and async session`

#### Agent Instructions

1. Implement `app/db/base.py` with SQLAlchemy declarative base
2. Implement `app/db/session.py` with async engine, connection pool per [PRD v2 - Database Connection Pooling](./PRD_v2.md#database-connection-pooling)
3. Implement `app/db/dependencies.py` with `get_db()` async generator
4. Implement SQLAlchemy models per [PRD v2 - Schema Details](./PRD_v2.md#schema-details):
   - `app/models/user.py`
   - `app/models/route.py` (with PostGIS geometry)
   - `app/models/photo.py` (with PostGIS geometry)
   - `app/models/tag.py`
   - `app/models/route_photo.py`, `route_tag.py` (junction tables)
5. Use GeoAlchemy2 for PostGIS geometry columns
6. Wire `get_db` into factory startup/shutdown

#### Design Constraints

- Schema: [PRD v2 - Database Design](./PRD_v2.md#database-design)
- Pool: pool_size 5-10, overflow 5, timeout 30s, recycle 3600s

#### Unit Tests

- `tests/unit/test_models.py`: Model creation, relationships (user->routes, route->photos)
- `tests/unit/test_db_session.py`: get_db yields session, session commits/rollbacks
- Test that geometry columns accept WKT/EWKT

#### UAT

- N/A

#### Definition of Done

- [ ] Models import without error
- [ ] `get_db` works in dependency injection
- [ ] All unit tests pass

---

### Step 1.3: Alembic Migrations

**Branch:** `feat/core-app`  
**Commit Message:** `feat(backend): add initial Alembic migration`

#### Agent Instructions

1. Initialize Alembic: `alembic init alembic`
2. Configure `alembic/env.py` for async SQLAlchemy and GeoAlchemy2
3. Create initial migration that:
   - Enables PostGIS extension
   - Creates all tables per [PRD v2 - Schema Details](./PRD_v2.md#schema-details)
   - Creates all indexes per PRD
4. Ensure migration is idempotent where possible (e.g., `CREATE EXTENSION IF NOT EXISTS postgis`)

#### Design Constraints

- [PRD v2 - Migration Strategy](./PRD_v2.md#migration-strategy)
- Tables: users, routes, photos, route_photos, tags, route_tags

#### Unit Tests

- `tests/integration/test_migrations.py`: `alembic upgrade head` succeeds, `alembic downgrade -1` succeeds

#### UAT

- N/A

#### Definition of Done

- [ ] `alembic upgrade head` runs successfully against local Postgres
- [ ] All tables exist with correct columns and indexes
- [ ] `alembic downgrade base` removes tables (if supported)

---

### Step 1.4: Health Check Endpoints

**Branch:** `feat/core-app`  
**Commit Message:** `feat(backend): add health check endpoints`

#### Agent Instructions

1. Implement `app/api/v1/health.py` per [PRD v2 - Health Check Endpoints](./PRD_v2.md#health-check-endpoints)
2. Endpoints: `GET /health`, `GET /health/db`, `GET /health/storage`
3. Wire router into factory with prefix (e.g., no `/v1` for health to keep it simple, or `/v1/health` if preferred)
4. For `GET /health/storage`, implement minimal S3 connectivity check (or skip if S3 not configured — return 503 with "not configured")
5. Include health router in `create_app`

#### Design Constraints

- [PRD v2 - Health Check Endpoints](./PRD_v2.md#health-check-endpoints)
- Response: `{"status": "healthy", "database": "connected"}` or 503 with error

#### Unit Tests

- `tests/integration/test_health.py`:
  - `GET /health` returns 200
  - `GET /health/db` returns 200 when DB connected, 503 when DB down
  - `GET /health/storage` returns 200 or 503 (mock S3 if needed)

#### UAT

- N/A

#### Definition of Done

- [ ] All three health endpoints respond
- [ ] Health checks pass when services are up
- [ ] Integration tests pass

---

## Phase 2: Authentication

**Goal:** Google OAuth, JWT, user creation. Enables protected routes.

**Design Reference:** [PRD v2 - FR1 Authentication](./PRD_v2.md#fr1-authentication), [API - Authentication](./PRD_v2.md#authentication)

---

### Step 2.1: Auth Service and JWT

**Branch:** `feat/auth`  
**Commit Message:** `feat(backend): add auth service with Google OAuth and JWT`

#### Agent Instructions

1. Implement `app/auth/jwt.py`: encode/decode access and refresh tokens per PRD
2. Implement `app/auth/oauth.py`: Google OAuth client (exchange code for user info)
3. Implement `app/auth/dependencies.py`: `get_current_user` (optional), `get_current_user_required`
4. Implement `app/services/auth_service.py`: `exchange_code_for_user`, `create_or_get_user`, `issue_tokens`, `refresh_tokens`, `logout`
5. Implement `app/schemas/user.py`: UserResponse (exclude sensitive fields)
6. Use HTTP-only cookie for refresh token per PRD

#### Design Constraints

- [PRD v2 - FR1](./PRD_v2.md#fr1-authentication), [API - Authentication](./PRD_v2.md#authentication)
- JWT: access 15min, refresh 7 days
- User model: id, google_id, email, name, avatar_url, created_at, updated_at

#### Unit Tests

- `tests/unit/test_auth_service.py`:
  - `create_or_get_user` creates new user when google_id not found
  - `create_or_get_user` returns existing user when google_id exists
  - `issue_tokens` returns access_token and sets refresh cookie
  - `refresh_tokens` returns new access_token from valid refresh token
  - `refresh_tokens` raises when refresh token invalid
- `tests/unit/test_jwt.py`: encode/decode roundtrip, expiry respected

#### UAT

- **UAT-1.1:** (Manual) User can complete Google OAuth flow and receive tokens (requires frontend or Postman)

#### Definition of Done

- [ ] Auth service creates/retrieves user correctly
- [ ] JWT encode/decode works
- [ ] Unit tests pass
- [ ] `get_current_user_required` raises 401 when no/invalid token

---

### Step 2.2: Auth API Endpoints

**Branch:** `feat/auth`  
**Commit Message:** `feat(backend): add auth API endpoints`

#### Agent Instructions

1. Implement `app/api/v1/auth.py`:
   - `POST /v1/auth/google` — body: `{code}`, returns `{access_token, user}`, sets refresh cookie
   - `POST /v1/auth/refresh` — reads cookie, returns `{access_token}`
   - `POST /v1/auth/logout` — clears cookie
   - `GET /v1/auth/me` — requires auth, returns `{user}`
2. Use Pydantic schemas for request/response
3. Wire auth router into factory
4. Handle OAuth errors (invalid code, network failure) with 400 and clear message

#### Design Constraints

- [PRD v2 - API - Authentication](./PRD_v2.md#authentication)
- Error format per PRD

#### Unit Tests

- `tests/integration/test_api_auth.py`:
  - `POST /v1/auth/google` with valid mock code returns 200 and user (mock Google OAuth)
  - `POST /v1/auth/google` with invalid code returns 400
  - `GET /v1/auth/me` without token returns 401
  - `GET /v1/auth/me` with valid token returns 200 and user
  - `POST /v1/auth/logout` clears refresh cookie

#### UAT

- **UAT-FR1.1:** As a user, I can sign in with Google OAuth → `POST /v1/auth/google` with valid code returns user and access_token
- **UAT-FR1.2:** User session persists → `POST /v1/auth/refresh` with valid cookie returns new access_token
- **UAT-FR1.3:** User can sign out → `POST /v1/auth/logout` clears cookie; subsequent refresh fails

#### Definition of Done

- [ ] All auth endpoints implemented
- [ ] Integration tests pass
- [ ] UAT scenarios pass (with mocked OAuth where needed)

---

### Step 2.3: Auth Frontend Flow

**Branch:** `feat/auth`  
**Commit Message:** `feat(frontend): add Google OAuth sign-in flow`

#### Agent Instructions

1. Implement `frontend/src/api/auth.ts`: login (redirect to Google), callback (exchange code), refresh, logout, getMe
2. Implement `frontend/src/store/authStore.ts` (or Context): current user, loading, login/logout actions
3. Implement `frontend/src/hooks/useAuth.ts`: wraps auth store, provides login/logout
4. Add login page/callback route
5. Axios client: attach Bearer token, intercept 401 to trigger refresh or redirect to login
6. Add "Sign in with Google" button that redirects to Google OAuth URL

#### Design Constraints

- [PRD v2 - Authentication Flow](./PRD_v2.md#authentication)
- Frontend structure per PRD

#### Unit Tests

- `frontend/src/api/auth.test.ts`: API functions call correct endpoints with correct payloads
- `frontend/src/store/authStore.test.ts`: login sets user, logout clears user

#### UAT

- **UAT-FR1 (Full):** As a user, I can sign in with Google OAuth
  - User clicks "Sign in with Google" → redirected to Google
  - After consent → redirected back with code → frontend calls backend → user logged in
  - Refresh page → user still logged in (refresh token)
  - User clicks Sign out → logged out, cookie cleared

#### Definition of Done

- [ ] Full OAuth flow works in browser
- [ ] Token refresh works on page reload
- [ ] Sign out clears session
- [ ] UAT-FR1 passes

---

## Phase 3: Routes

**Goal:** Create, read, update, delete routes. Route geometry, slug, tags.

**Design Reference:** [PRD v2 - FR2 Route Creation](./PRD_v2.md#fr2-route-creation), [API - Routes](./PRD_v2.md#routes)

---

### Step 3.1: Route Service and Schemas

**Branch:** `feat/routes`  
**Commit Message:** `feat(backend): add route service, schemas, and geometry utils`

#### Agent Instructions

1. Implement `app/utils/geometry.py`: validate LineString, calculate distance (using PostGIS or Shapely)
2. Implement `app/utils/slug.py`: generate slug from title + short id, handle collisions
3. Implement `app/schemas/route.py`: RouteCreate, RouteUpdate, RouteResponse (GeoJSON for geometry)
4. Implement `app/services/route_service.py`:
   - `create_route(user_id, data)` — validate geometry, generate slug, insert route + tags
   - `get_route_by_slug(slug)` — return route with photos and tags
   - `get_route_by_id(id)` — same
   - `update_route(route_id, user_id, data)` — ownership check, update
   - `delete_route(route_id, user_id)` — ownership check, delete
5. Enforce: polyline ≥2 points, distance >0, title 1-100 chars, max 5 tags
6. Private by default, slug format `{title-slug}-{short-id}`

#### Design Constraints

- [PRD v2 - FR2](./PRD_v2.md#fr2-route-creation)
- [PRD v2 - Schema - routes](./PRD_v2.md#table-routes)
- Geometry: WGS84, LineString

#### Unit Tests

- `tests/unit/test_route_service.py`:
  - create_route validates geometry (reject <2 points)
  - create_route generates unique slug
  - create_route with override slug uses it if unique
  - create_route with duplicate override slug appends suffix
  - get_route_by_slug returns 404 for invalid slug
  - update_route returns 403 when user is not owner
  - delete_route returns 403 when user is not owner
- `tests/unit/test_slug.py`: slug generation, collision handling
- `tests/unit/test_geometry.py`: distance calculation, validation

#### UAT

- N/A (service layer; UAT in Step 3.3)

#### Definition of Done

- [ ] Route service implements all CRUD operations
- [ ] Slug generation and collision handling work
- [ ] Geometry validation works
- [ ] Unit tests pass

---

### Step 3.2: Route API Endpoints

**Branch:** `feat/routes`  
**Commit Message:** `feat(backend): add route API endpoints`

#### Agent Instructions

1. Implement `app/api/v1/routes.py`:
   - `POST /v1/routes` — auth required, body RouteCreate
   - `GET /v1/routes/{slug}` — auth optional, return route + photos
   - `PATCH /v1/routes/{id}` — auth required, owner only
   - `DELETE /v1/routes/{id}` — auth required, owner only
2. For `GET /v1/routes/{slug}`: if route private, require auth and ownership
3. Use Pydantic for request validation
4. Return 404 for invalid slug/id, 403 for unauthorized

#### Design Constraints

- [PRD v2 - API - Routes](./PRD_v2.md#routes)
- Error responses per PRD

#### Unit Tests

- `tests/integration/test_api_routes.py`:
  - POST /v1/routes creates route, returns 201
  - POST /v1/routes without auth returns 401
  - GET /v1/routes/{slug} returns route for public route
  - GET /v1/routes/{slug} returns 403 for private route when not owner
  - GET /v1/routes/{slug} returns 404 for invalid slug
  - PATCH /v1/routes/{id} by non-owner returns 403
  - DELETE /v1/routes/{id} by non-owner returns 403

#### UAT

- **UAT-FR2.1:** Create route with valid data → 201, route returned with slug
- **UAT-FR2.2:** Create route with invalid geometry → 400
- **UAT-FR2.3:** Get public route by slug → 200, route + photos
- **UAT-FR2.4:** Get private route as owner → 200
- **UAT-FR2.5:** Get private route as non-owner → 403

#### Definition of Done

- [ ] All route endpoints implemented
- [ ] Integration tests pass
- [ ] UAT scenarios pass

---

### Step 3.3: Route Frontend - Creation

**Branch:** `feat/routes`  
**Commit Message:** `feat(frontend): add route creation with map drawing`

#### Agent Instructions

1. Implement `frontend/src/components/map/MapView.tsx`: MapLibre GL map
2. Implement `frontend/src/components/map/RouteDrawer.tsx`: Mapbox GL Draw for polyline
3. Implement `frontend/src/components/routes/RouteForm.tsx`: title, description, tags, is_public, draw route on map
4. Implement `frontend/src/pages/CreateRoute.tsx`: form + map, submit to POST /v1/routes
5. Client-side validation: Turf.js for geometry (≥2 points, distance >0)
6. Redirect to route page on success

#### Design Constraints

- [PRD v2 - FR2](./PRD_v2.md#fr2-route-creation)
- MapLibre GL JS, Mapbox GL Draw, Turf.js per PRD

#### Unit Tests

- RouteForm validation: title required, geometry required
- API client: POST /v1/routes sends correct payload

#### UAT

- **UAT-FR2 (Create):** As a user, I can create a photowalk route by drawing on a map
  - User draws polyline on map
  - User fills title, optional description, optional tags
  - User submits → route created → redirected to route page
  - Route appears with correct slug and geometry

#### Definition of Done

- [ ] User can draw route on map
- [ ] Form validates and submits
- [ ] Route is created and user redirected
- [ ] UAT-FR2 (Create) passes

---

### Step 3.4: Route Frontend - Viewing

**Branch:** `feat/routes`  
**Commit Message:** `feat(frontend): add route detail page with map and gallery`

#### Agent Instructions

1. Implement `frontend/src/pages/RouteDetail.tsx`: fetch route by slug, display map + gallery
2. Implement `frontend/src/components/routes/RouteView.tsx`: map with route polyline, photo pins (or placeholder), metadata (title, description, author, distance, tags)
3. Implement `frontend/src/components/map/PhotoMarker.tsx`: pin for photo location (can show placeholder until photos exist)
4. Route at `/routes/{slug}`
5. Handle 404 and 403 with appropriate UI
6. Empty photo gallery message when no photos

#### Design Constraints

- [PRD v2 - FR4 Route Viewing](./PRD_v2.md#fr4-route-viewing-public)

#### Unit Tests

- RouteView renders route metadata
- RouteDetail handles 404

#### UAT

- **UAT-FR4:** As a visitor, I can view a shared route via public URL
  - Navigate to /routes/{slug} for public route → map shows route, metadata visible
  - Navigate to /routes/{slug} for private route (not owner) → 403 message
  - Navigate to /routes/invalid-slug → 404 message
  - Route with no photos → map shows route, "No photos yet" message

#### Definition of Done

- [ ] Route page loads and displays route
- [ ] Map shows route polyline
- [ ] Metadata visible
- [ ] UAT-FR4 passes

---

## Phase 4: Photos

**Goal:** Upload photos, EXIF GPS extraction, S3 storage, thumbnails, association with routes.

**Design Reference:** [PRD v2 - FR3 Photo Upload](./PRD_v2.md#fr3-photo-upload-and-association), [API - Photos](./PRD_v2.md#photos)

---

### Step 4.1: Storage and Photo Models

**Branch:** `feat/photos`  
**Commit Message:** `feat(backend): add S3 storage client and photo models`

#### Agent Instructions

1. Implement `app/storage/s3.py`: upload file, delete file, get presigned URL (optional), check connectivity
2. S3 key format: `photos/{user_id}/{photo_id}/original.jpg`, `photos/{user_id}/{photo_id}/thumbnail.jpg`
3. Photo model already exists from Step 1.2; verify route_photos junction table
4. Implement `app/schemas/photo.py`: PhotoResponse, PhotoUpdate (caption, route_ids)
5. Support local file storage for development (e.g., local directory if S3 not configured)

#### Design Constraints

- [PRD v2 - FR3](./PRD_v2.md#fr3-photo-upload-and-association)
- S3 structure per PRD

#### Unit Tests

- `tests/unit/test_s3.py`: upload stores file, delete removes file (use moto or local filesystem)
- Schema: PhotoResponse excludes internal fields

#### UAT

- N/A

#### Definition of Done

- [ ] S3 client works (or local fallback)
- [ ] Photo schemas defined
- [ ] Unit tests pass

---

### Step 4.2: EXIF and Photo Service

**Branch:** `feat/photos`  
**Commit Message:** `feat(backend): add EXIF extraction and photo service`

#### Agent Instructions

1. Implement `app/utils/exif.py`: extract GPS coordinates from JPEG, return (lat, lon) or None
2. Implement `app/services/photo_service.py`:
   - `upload_photo(user_id, file, caption, route_ids)` — extract EXIF, reject if no GPS, upload to S3, insert photo + route_photos
   - `get_photos_by_route(route_id, order)` — return photos for route
   - `update_photo(photo_id, user_id, caption, route_ids)` — ownership check
   - `delete_photo(photo_id, user_id)` — ownership check, delete from S3, remove route_photos
3. Enforce: JPEG only, max 10MB, max 50 photos per route
4. Enqueue thumbnail job after photo created (Step 4.3 will implement worker)

#### Design Constraints

- [PRD v2 - FR3](./PRD_v2.md#fr3-photo-upload-and-association)
- GPS required; reject if missing

#### Unit Tests

- `tests/unit/test_exif.py`: extract GPS from sample JPEG with EXIF, return None for image without GPS
- `tests/unit/test_photo_service.py`:
  - upload_photo rejects when no GPS in EXIF
  - upload_photo creates photo and route_photos
  - get_photos_by_route returns photos in display_order
  - update_photo/drop_photo enforce ownership

#### UAT

- N/A

#### Definition of Done

- [ ] EXIF extraction works
- [ ] Photo service implements upload, get, update, delete
- [ ] Unit tests pass

---

### Step 4.3: Thumbnail Worker

**Branch:** `feat/photos`  
**Commit Message:** `feat(backend): add thumbnail generation worker`

#### Agent Instructions

1. Implement thumbnail job: download original from S3, resize to max 800px width (Pillow), upload thumbnail to S3
2. Use Celery + Redis or RQ (per PRD)
3. Job: on photo created, enqueue `generate_thumbnail(photo_id)`
4. On completion, update photo.s3_key_thumbnail
5. Handle failures: log error, optionally retry
6. Add worker process to docker-compose

#### Design Constraints

- [PRD v2 - FR3](./PRD_v2.md#fr3-photo-upload-and-association): thumbnail max 800px width

#### Unit Tests

- `tests/unit/test_thumbnail.py`: resize produces image ≤800px width, aspect ratio preserved

#### UAT

- N/A (async job)

#### Definition of Done

- [ ] Thumbnail job runs when photo uploaded
- [ ] Photo record updated with thumbnail key
- [ ] Worker runs in docker-compose

---

### Step 4.4: Photo API Endpoints

**Branch:** `feat/photos`  
**Commit Message:** `feat(backend): add photo API endpoints`

#### Agent Instructions

1. Implement `app/api/v1/photos.py`:
   - `POST /v1/photos` — multipart: file, caption, route_ids
   - `GET /v1/routes/{route_id}/photos` — order param
   - `PATCH /v1/photos/{id}` — caption, route_ids
   - `DELETE /v1/photos/{id}`
2. Validate: JPEG, 10MB max
3. Request timeout 60s for upload
4. Return photo with s3_key_thumbnail (may be null until worker completes)

#### Design Constraints

- [PRD v2 - API - Photos](./PRD_v2.md#photos)

#### Unit Tests

- `tests/integration/test_api_photos.py`:
  - POST /v1/photos with valid JPEG + GPS returns 201
  - POST /v1/photos with JPEG without GPS returns 400
  - POST /v1/photos with non-JPEG returns 400
  - GET /v1/routes/{id}/photos returns photos
  - PATCH/DELETE enforce ownership

#### UAT

- **UAT-FR3.1:** Upload photo with EXIF GPS → 201, photo created, associated with route
- **UAT-FR3.2:** Upload photo without EXIF GPS → 400 with clear error
- **UAT-FR3.3:** Associate photo with multiple routes → photo appears on each route

#### Definition of Done

- [ ] All photo endpoints implemented
- [ ] Integration tests pass
- [ ] UAT scenarios pass

---

### Step 4.5: Photo Frontend

**Branch:** `feat/photos`  
**Commit Message:** `feat(frontend): add photo upload and gallery`

#### Agent Instructions

1. Implement photo upload UI: file picker, caption, route selection (multi-select)
2. Implement gallery on route page: display photos, click to open modal/lightbox
3. Photo pins on map: show PhotoMarker at each photo location, click to highlight in gallery
4. Handle upload progress, success, error (especially "GPS required")
5. Use thumbnail URL when available, fallback to original

#### Design Constraints

- [PRD v2 - FR3](./PRD_v2.md#fr3-photo-upload-and-association), [FR4](./PRD_v2.md#fr4-route-viewing-public)

#### Unit Tests

- Photo upload sends multipart with file, caption, route_ids
- Gallery renders photos from API

#### UAT

- **UAT-FR3 (Full):** As a user, I can upload photos and attach them to routes
  - User selects photo with GPS → uploads → photo appears as pin on map and in gallery
  - User selects photo without GPS → error message "Photo must contain GPS data"
  - User can add caption and associate with multiple routes
- **UAT-FR4 (Photos):** Click photo pin → photo opens in gallery/modal

#### Definition of Done

- [ ] Upload flow works
- [ ] Gallery displays photos
- [ ] Photo pins on map, click opens photo
- [ ] UAT-FR3 and FR4 (photo parts) pass

---

## Phase 5: Discovery

**Goal:** Browse public routes by map viewport and filters.

**Design Reference:** [PRD v2 - FR5 Route Browsing](./PRD_v2.md#fr5-route-browsing), [API - GET /v1/routes](./PRD_v2.md#get-v1routes-browse)

---

### Step 5.1: Discovery Service

**Branch:** `feat/discovery`  
**Commit Message:** `feat(backend): add discovery service with spatial queries`

#### Agent Instructions

1. Implement `app/services/discovery_service.py`:
   - `browse_routes(bbox, tags, author_id, page, per_page, sort)` — spatial query with ST_Intersects, filter by tags, paginate
   - Only return public routes
   - Limit bbox to max 50km²
2. Use PostGIS `ST_Intersects(route_geometry, ST_MakeEnvelope(...))`
3. Tags: AND logic when multiple provided

#### Design Constraints

- [PRD v2 - FR5](./PRD_v2.md#fr5-route-browsing)
- [PRD v2 - Bbox Queries](./PRD_v2.md#bbox-queries)

#### Unit Tests

- `tests/unit/test_discovery_service.py`:
  - browse_routes returns only public routes
  - bbox filter returns routes within bounds
  - tags filter applies AND logic
  - pagination works
  - bbox too large returns error or clamped

#### UAT

- N/A

#### Definition of Done

- [ ] Discovery service implements browse
- [ ] Spatial query works
- [ ] Unit tests pass

---

### Step 5.2: Discovery API and Frontend

**Branch:** `feat/discovery`  
**Commit Message:** `feat(backend): add discovery API endpoint`

#### Agent Instructions

1. Implement `GET /v1/routes` in `app/api/v1/discovery.py` (or extend routes.py): query params bbox, tags, author_id, page, per_page, sort
2. Return `{routes, pagination}`

#### Design Constraints

- [PRD v2 - API - GET /v1/routes](./PRD_v2.md#get-v1routes-browse)

#### Unit Tests

- `tests/integration/test_api_discovery.py`: GET /v1/routes with bbox returns routes in area

#### UAT

- **UAT-FR5.1:** GET /v1/routes?bbox=... returns public routes in viewport
- **UAT-FR5.2:** GET /v1/routes?tags=urban returns routes with tag

#### Definition of Done

- [ ] Discovery endpoint works
- [ ] Integration tests pass

---

### Step 5.3: Browse Frontend

**Branch:** `feat/discovery`  
**Commit Message:** `feat(frontend): add browse page with map and list view`

#### Agent Instructions

1. Implement `frontend/src/pages/Browse.tsx`: map view + list view toggle
2. Map view: show route markers within viewport, fetch on pan/zoom (bbox from map bounds)
3. List view: paginated list, sort by date
4. Filter by tags
5. Click route → navigate to RouteDetail

#### Design Constraints

- [PRD v2 - FR5](./PRD_v2.md#fr5-route-browsing)

#### Unit Tests

- Browse fetches routes with bbox from map
- List view pagination

#### UAT

- **UAT-FR5:** As a visitor, I can browse public routes
  - Map view shows routes in viewport
  - List view shows paginated routes
  - Filter by tag works
  - Click route → route detail page

#### Definition of Done

- [ ] Browse page implemented
- [ ] Map and list views work
- [ ] UAT-FR5 passes

---

## Phase 6: Frontend Polish

**Goal:** Home page, navigation, UX refinements, error handling.

---

### Step 6.1: Navigation and Home

**Branch:** `feat/frontend-polish`  
**Commit Message:** `feat(frontend): add navigation and home page`

#### Agent Instructions

1. Implement navigation: Home, Browse, Create Route, Sign In/Out
2. Implement `Home.tsx`: landing/welcome, CTA to browse or create
3. Protected routes: Create Route requires auth, redirect to login if not
4. 404 page

#### Unit Tests

- Protected route redirects when not authenticated

#### UAT

- User can navigate between Home, Browse, Create
- Unauthenticated user clicking Create → redirect to login

#### Definition of Done

- [ ] Navigation works
- [ ] Home page renders
- [ ] Protected routes enforce auth

---

### Step 6.2: Error Handling and Loading States

**Branch:** `feat/frontend-polish`  
**Commit Message:** `feat(frontend): add error handling and loading states`

#### Agent Instructions

1. Global error boundary
2. Loading states for async operations (skeletons or spinners)
3. Toast or inline error messages for API failures
4. Retry for transient errors

#### UAT

- API error shows user-friendly message
- Loading state shown during fetches

#### Definition of Done

- [ ] Errors handled gracefully
- [ ] Loading states visible

---

## Phase 7: Integration & Polish

**Goal:** E2E tests, rate limiting, deployment readiness.

---

### Step 7.1: Rate Limiting

**Branch:** `feat/integration`  
**Commit Message:** `feat(backend): add rate limiting middleware`

#### Agent Instructions

1. Add rate limiting per [PRD v2 - NFR4](./PRD_v2.md#nfr4-rate-limiting)
2. Limits: 100 req/min IP, 500 req/min authenticated, 10 uploads/min user, 5 routes/hour user
3. Return 429 with Retry-After header
4. Use in-memory store for MVP (or Redis if available)

#### Unit Tests

- Rate limit returns 429 when exceeded

#### Definition of Done

- [ ] Rate limiting active
- [ ] 429 returned when limit exceeded

---

### Step 7.2: E2E Tests

**Branch:** `feat/integration`  
**Commit Message:** `test: add E2E tests for critical flows`

#### Agent Instructions

1. Implement E2E tests per [PRD v2 - NFR6](./PRD_v2.md#nfr6-testing):
   - Create route flow (auth → create route → view route)
   - Upload photo flow (auth → create route → upload photo → view route with photo)
   - Browse flow (view browse → select route → view route)
2. Use Playwright or Cypress
3. Tests run against local stack (docker-compose)
4. Mock Google OAuth for E2E (or use test account)

#### UAT

- E2E tests cover UAT-FR1, FR2, FR3, FR4, FR5 end-to-end

#### Definition of Done

- [ ] E2E tests pass
- [ ] All critical flows covered

---

### Step 7.3: Docker and Deployment Config

**Branch:** `feat/integration`  
**Commit Message:** `chore: add Dockerfile and deployment configuration`

#### Agent Instructions

1. Create `backend/Dockerfile` per [PRD v2 - Containerization](./PRD_v2.md#containerization)
2. Multi-stage build if beneficial
3. Document deployment steps in README
4. Add production docker-compose override (optional)

#### Definition of Done

- [ ] Dockerfile builds
- [ ] Container runs backend
- [ ] README documents deployment

---

### Step 7.4: Documentation and Final Review

**Branch:** `feat/integration`  
**Commit Message:** `docs: add API documentation and implementation summary`

#### Agent Instructions

1. Ensure OpenAPI spec is accurate (from FastAPI auto-gen or manual)
2. Add `docs/` or section in README: how to run locally, run tests, deploy
3. Add CONTRIBUTING.md referencing this roadmap and PRD
4. Verify all UAT scenarios documented and passing

#### Definition of Done

- [ ] API docs complete
- [ ] Local run instructions work
- [ ] CONTRIBUTING references design authority

---

## UAT Master Checklist

| ID | User Story | Steps | Status |
|----|------------|-------|--------|
| UAT-FR1 | As a user, I can sign in with Google OAuth | 2.2, 2.3 | |
| UAT-FR2 | As a user, I can create a photowalk route | 3.2, 3.3 | |
| UAT-FR3 | As a user, I can upload photos and attach to routes | 4.4, 4.5 | |
| UAT-FR4 | As a visitor, I can view a shared route | 3.4, 4.5 | |
| UAT-FR5 | As a visitor, I can browse public routes | 5.2, 5.3 | |

---

## Git Workflow

- **Branch per phase:** `feat/<phase-name>` (e.g., `feat/auth`, `feat/routes`)
- **Commit per step:** One commit per step, message format `type(scope): description`
- **PR per phase:** Merge `feat/<phase>` into `main` after all steps in phase complete and tests pass
- **Tags:** Optionally tag each phase: `v0.1-foundation`, `v0.2-auth`, etc.

---

## Agent Quick Reference

When starting a step:

1. **Read** the step's Agent Instructions and Design Constraints
2. **Reference** [PRD v2](./PRD_v2.md) for any ambiguity
3. **Implement** exactly as specified; do not add features
4. **Write** the required Unit Tests and UAT
5. **Verify** Definition of Done before committing
6. **Stop** if a design change is needed; document and request approval

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-05
