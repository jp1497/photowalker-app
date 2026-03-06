# Codebase Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a comprehensive review report covering PRD alignment, code quality, and test coverage, with a prioritized action list.

**Architecture:** Three parallel subagent passes (PRD, code quality, tests) feed a synthesis step that produces a single `docs/plans/2026-03-06-codebase-review-report.md`.

**Tech Stack:** FastAPI (Python), React + TypeScript, pytest, Vitest, PostGIS, S3, JWT/OAuth

---

## Severity Scale

| Level | Meaning |
|-------|---------|
| P0 | Ship blocker — must fix before release |
| P1 | Important — fix soon after release |
| P2 | Tech debt — fix eventually |

## Finding Format (use this in every pass)

```
[P0/P1/P2] area: description
File: path/to/file.py:line (if applicable)
Fix: brief recommendation
```

---

## Task 1: PRD Alignment Pass (subagent)

**Goal:** Read every feature/requirement in the PRD, find the corresponding backend + frontend code, and flag gaps.

**Files to read:**
- `design/PRD.md` — single source of truth
- `backend/app/api/v1/routes.py`
- `backend/app/api/v1/photos.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/health.py`
- `backend/app/api/v1/discovery.py`
- `backend/app/services/route_service.py`
- `backend/app/services/photo_service.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/discovery_service.py`
- `backend/app/models/route.py`
- `backend/app/models/photo.py`
- `backend/app/models/user.py`
- `backend/app/models/route_photo.py`
- `backend/app/models/tag.py`
- `backend/app/models/route_tag.py`
- `frontend/src/pages/Browse.tsx`
- `frontend/src/pages/RouteDetail.tsx`
- `frontend/src/pages/CreateRoute.tsx`
- `frontend/src/pages/CreateRouteFromPhotos.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/explore/ExploreRoutesPanel.tsx`
- `frontend/src/components/map/MapShell.tsx`
- `frontend/src/components/map/MapView.tsx`
- `frontend/src/components/map/RouteDrawer.tsx`
- `frontend/src/components/common/BottomDrawer.tsx`
- `frontend/src/components/common/WelcomeModal.tsx`
- `frontend/src/components/photos/PhotoGallery.tsx`
- `frontend/src/components/photos/PhotoUploadForm.tsx`
- `frontend/src/components/routes/RouteForm.tsx`
- `frontend/src/components/routes/RouteView.tsx`
- `frontend/src/api/routes.ts`
- `frontend/src/api/photos.ts`
- `frontend/src/api/auth.ts`

**Step 1: Extract PRD requirements**

Read `design/PRD.md`. Build a checklist of every requirement ID:
- FR1: Auth (Google OAuth sign-in, JWT, refresh, logout, /auth/me)
- FR2: Route Creation (photo-first via `POST /routes/from-photos`; draw-first via `POST /routes`)
- FR3: Photo Upload (JPEG, 10MB, EXIF GPS, S3, async thumbnail)
- FR4: Route Viewing (`/routes/{slug}`, polyline, photo pins, gallery, 404/403 handling)
- FR5: Route Browsing (bbox queries, tag/author filter, pagination, sort)
- FR-R1: Photo-first creation (EXIF auto-plot, place-on-map for missing GPS, drag reorder, from-photos endpoint)
- FR-R2: Route–photo consistency (geometry recomputed on photo add/remove/reorder)
- FR-R3: Nullable location, `PATCH /photos/{id}` location update, triggers recompute
- FR-R4/R8: Thumbnail pins (~40-48px), fallback dot, clustering, expand on click/zoom
- FR-R5/R6: Bulk reorder (`PATCH /routes/{id}/photos/order`), add/remove photos, publish guard
- FR-R7: GPX export (`GET /routes/{slug}/gpx`, track + waypoints, application/gpx+xml)
- FR-R9: Undo/Redo in create flow (Ctrl+Z / Ctrl+Shift+Z, last ~20 actions)
- FR-R10: Drafts (`POST /drafts`, `GET /drafts`, `PATCH /drafts/{id}/publish`, `DELETE /drafts/{id}`)
- FR-U1: `/` → `/browse`, welcome modal (sessionStorage, dismissible)
- FR-U2: Browse photo-only pins, lightbox with photo+user+routes
- FR-U3: Explore panel, All/My routes filter, Create button, hover highlights route on map
- FR-U4: BottomDrawer (peek+expand) for route view and create
- FR-U5: Account icon top-right only; Sign in / Settings / Sign out
- FR-U6: No `/routes/me`; My routes only as panel filter
- FR-U7: Touch targets ≥44px, rem/% sizing
- NFR3: Rate limits (100/min anon, 500/min auth, 10/min uploads)
- NFR4: JWT 15min, refresh 7 days HTTP-only, CORS
- NFR5: ≥80% unit coverage

**Step 2: Verify each requirement against the code**

For each requirement:
1. Find the backend endpoint(s) or service method(s) that implement it
2. Find the frontend page/component that exercises it
3. Check for any tests that cover it (look in `backend/tests/` and `frontend/src/**/*.test.*`)
4. Record status: ✓ Implemented / ⚠ Partial / ✗ Missing

Pay special attention to these known-risky areas:
- Drafts endpoints — does `backend/app/api/v1/` have a drafts router? Check `backend/app/core/factory.py` to see which routers are registered
- GPX export — is `GET /routes/{slug}/gpx` implemented in `routes.py`?
- Undo/Redo — is this in `CreateRouteFromPhotos.tsx` or `RouteDrawer.tsx`?
- Route geometry recomputation on photo change — is this in `route_service.py`?
- `PATCH /routes/{route_id}/photos/order` — is this endpoint present?
- `DELETE /routes/{route_id}/photos/{photo_id}` — is this endpoint present?
- `GET /photos/me` — this was recently added (latest commit); is it in the PRD? Flag if not.
- Welcome modal sessionStorage — is it in `WelcomeModal.tsx` or `welcomeStorage.ts`?
- `PATCH /photos/{id}` for location update — does it exist and trigger route recompute?

**Step 3: Record findings**

Produce a structured list using the finding format above. Group by requirement ID.

Also produce a summary table:

```
| Req ID | Description | Backend | Frontend | Tests | Status |
|--------|-------------|---------|----------|-------|--------|
| FR1    | Auth        | ...     | ...      | ...   | ✓/⚠/✗ |
```

**Step 4: Save raw findings**

Save output to `docs/plans/2026-03-06-review-pass1-prd.md`

---

## Task 2: Code Quality Pass (subagent)

**Goal:** Read backend and frontend source files for architecture issues, security problems, error handling gaps, and tech debt.

### Backend Quality Review

**Files to read:**
- `backend/app/core/config.py`
- `backend/app/core/factory.py`
- `backend/app/core/exceptions.py`
- `backend/app/core/logging.py`
- `backend/app/auth/jwt.py`
- `backend/app/auth/oauth.py`
- `backend/app/auth/dependencies.py`
- `backend/app/middleware/error_handler.py`
- `backend/app/middleware/rate_limit.py`
- `backend/app/db/session.py`
- `backend/app/db/base.py`
- `backend/app/db/dependencies.py`
- `backend/app/storage/s3.py`
- `backend/app/utils/exif.py`
- `backend/app/utils/geometry.py`
- `backend/app/utils/slug.py`
- `backend/app/utils/thumbnail.py`
- `backend/app/workers/thumbnail_job.py`
- `backend/app/services/route_service.py`
- `backend/app/services/photo_service.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/discovery_service.py`
- `backend/app/api/v1/routes.py`
- `backend/app/api/v1/photos.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/discovery.py`
- `backend/app/api/v1/health.py`
- `backend/app/schemas/auth.py`
- `backend/app/schemas/route.py`
- `backend/app/schemas/photo.py`
- `backend/app/schemas/user.py`

**What to look for — backend:**

Security:
- JWT secret/key handling — is `SECRET_KEY` validated as non-empty/non-default in config?
- Are refresh tokens stored HTTP-only? Check `auth.py` cookie settings
- CORS — is `allow_origins` set to `["*"]` anywhere? (P0 for production)
- Are any endpoints missing auth dependencies that should require them?
- S3 presigned URL expiry — check `storage/s3.py` for sensible TTLs
- SQL injection risk — are all queries using ORM/parameterized? (look for raw string formatting)

Error handling:
- Do services raise typed exceptions (from `core/exceptions.py`) or bare `Exception`?
- Does the error handler middleware catch all exception types?
- Are there unhandled cases where a 500 could leak stack traces?

Data integrity:
- Is `location` nullable on the Photo model? Does it match the PRD (`photos.location` = nullable Point)?
- Is `is_draft` on the Route model?
- Are PostGIS geometry columns defined correctly (SRID 4326)?
- Are there database constraints that match business rules (e.g. title length 1-100)?

Architecture:
- Is business logic leaking into API handlers (should be in services)?
- Are there circular imports or inappropriate cross-module dependencies?
- Is the factory pattern applied consistently?

Rate limiting:
- Does rate_limit middleware apply different limits for anon vs auth (100 vs 500 req/min)?
- Is the 10 uploads/min limit enforced?

**Files to read — frontend:**

- `frontend/src/api/client.ts`
- `frontend/src/api/auth.ts`
- `frontend/src/api/routes.ts`
- `frontend/src/api/photos.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/store/toastStore.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useRoutes.ts`
- `frontend/src/hooks/useMap.ts`
- `frontend/src/contexts/MapContext.tsx`
- `frontend/src/contexts/HighlightedRouteContext.tsx`
- `frontend/src/contexts/RoutesPanelContext.tsx`
- `frontend/src/components/common/ProtectedRoute.tsx`
- `frontend/src/components/common/ErrorBoundary.tsx`
- `frontend/src/types/api.ts`
- `frontend/src/types/route.ts`
- `frontend/src/types/photo.ts`
- `frontend/src/utils/validation.ts`
- `frontend/src/utils/geometry.ts`
- `frontend/src/map/mapStyles.ts`
- `frontend/src/map/poiConfig.ts`
- `frontend/src/components/map/clusterConfig.ts`
- `frontend/src/components/map/pinImageUtils.ts`

**What to look for — frontend:**

API error handling:
- Does `client.ts` handle 401 (token expiry) and attempt refresh?
- Are API errors surfaced to users via the toast/error system, or silently swallowed?
- Are there `async` functions with missing `try/catch` in API calls?

Type safety:
- Are there `any` types in `types/api.ts`, `types/route.ts`, `types/photo.ts`? Flag each one
- Are API responses validated (e.g. with Zod) or just cast?
- Are there type assertions (`as SomeType`) that could hide runtime errors?

State management:
- Is auth state (JWT, user) stored securely? (avoid localStorage for tokens)
- Is there any state that could leak between users (e.g. cached data not cleared on logout)?
- Are there race conditions in async state updates?

Component patterns:
- Are there components doing too much (fetching + display + business logic mixed)?
- Is `ErrorBoundary` used at appropriate levels?
- Are loading states handled consistently?

Accessibility:
- Do interactive elements have `aria-label` or visible labels?
- Are touch targets ≥44px (check CSS in components or Tailwind classes)?
- Is focus management handled when drawers/modals open?

**Step: Record findings**

Save output to `docs/plans/2026-03-06-review-pass2-quality.md`

---

## Task 3: Test Coverage Pass (subagent)

**Goal:** Run both test suites, capture results, read test files for quality, identify gaps.

### Step 1: Run backend tests

```bash
cd /Users/jakephillips/Documents/photowalker-app/backend
python -m pytest --tb=short -q 2>&1 | head -100
```

Note: If DB is not running, pytest may fail on integration tests. Try:
```bash
python -m pytest tests/unit/ --tb=short -q
```

Record: total passed/failed/skipped, any failures with error messages.

### Step 2: Run frontend tests

```bash
cd /Users/jakephillips/Documents/photowalker-app/frontend
npm run test -- --reporter=verbose --run 2>&1 | head -150
```

Record: total passed/failed/skipped, any failures.

### Step 3: Read backend unit tests for quality

Read all files in `backend/tests/unit/`:
- `test_auth_service.py`
- `test_config.py`
- `test_db_session.py`
- `test_discovery_service.py`
- `test_error_handler.py`
- `test_exif.py`
- `test_factory.py`
- `test_geometry.py`
- `test_jwt.py`
- `test_models.py`
- `test_photo_schemas.py`
- `test_photo_service.py`
- `test_placeholder.py`
- `test_rate_limit.py`
- `test_route_service.py`
- `test_s3.py`
- `test_slug.py`
- `test_thumbnail.py`

For each test file, assess:
- Are assertions meaningful (not just `assert result is not None`)?
- Are edge cases tested (empty input, null, max values, errors)?
- Are mocks used appropriately (not over-mocked to the point tests don't test anything)?
- Are there placeholder tests (empty bodies, `pass`, `assert True`)?

### Step 4: Read backend integration tests for quality

Read all files in `backend/tests/integration/`:
- `test_api_auth.py`
- `test_api_discovery.py`
- `test_api_photos.py`
- `test_api_routes.py`
- `test_auth_dependencies.py`
- `test_health.py`
- `test_migrations.py`

For each, assess:
- Do tests cover happy path AND error cases (400, 401, 403, 404)?
- Are auth-protected endpoints tested without auth (expect 401)?
- Are input validation boundaries tested (empty title, title > 100 chars, etc.)?

### Step 5: Read frontend tests for quality

Read all frontend test files:
- `frontend/src/api/auth.test.ts`
- `frontend/src/api/photos.test.ts`
- `frontend/src/api/routes.test.ts`
- `frontend/src/store/authStore.test.ts`
- `frontend/src/utils/geometry.test.ts`
- `frontend/src/components/common/ProtectedRoute.test.tsx`
- `frontend/src/components/common/AccountIcon.test.tsx`
- `frontend/src/components/common/BottomDrawer.test.tsx`
- `frontend/src/components/common/DrawerMenu.test.tsx`
- `frontend/src/components/map/MapPicker.test.tsx`
- `frontend/src/components/map/PhotoMarker.test.ts`
- `frontend/src/components/routes/RouteForm.test.tsx`
- `frontend/src/components/routes/RouteView.test.tsx`
- `frontend/src/components/explore/ExploreRoutesPanel.test.tsx`
- `frontend/src/components/photos/PhotoGallery.test.tsx`
- `frontend/src/pages/Browse.test.tsx`
- `frontend/src/pages/RouteDetail.test.tsx`
- `frontend/src/pages/CreateRouteFromPhotos.test.tsx`
- `frontend/src/App.test.tsx`

For each, assess same criteria as backend.

### Step 6: Identify coverage gaps

List every source module/component that has NO test file at all. Reference these source files that exist but appear untested:
- Backend: any `.py` in `backend/app/` with no corresponding test in `backend/tests/`
- Frontend: any `.ts`/`.tsx` in `frontend/src/` with no `.test.` counterpart

Notable areas to check explicitly:
- `backend/app/workers/thumbnail_job.py` — tested?
- `backend/app/storage/s3.py` — tested (has `test_s3.py` but verify depth)
- `backend/app/middleware/rate_limit.py` — tested?
- `frontend/src/hooks/useRoutes.ts` — tested?
- `frontend/src/hooks/useMap.ts` — tested?
- `frontend/src/hooks/useAuth.ts` — tested?
- `frontend/src/contexts/MapContext.tsx` — tested?
- `frontend/src/map/mapStyles.ts` — tested?
- `frontend/src/components/photos/PhotoUploadForm.tsx` — tested?
- `frontend/src/pages/CreateRoute.tsx` — tested?
- `frontend/src/pages/Settings.tsx` — tested?

### Step 7: Record findings

Save output to `docs/plans/2026-03-06-review-pass3-tests.md`

---

## Task 4: Synthesis (main session — after all three passes complete)

**Goal:** Read the three pass outputs and produce the final report.

**Files to read:**
- `docs/plans/2026-03-06-review-pass1-prd.md`
- `docs/plans/2026-03-06-review-pass2-quality.md`
- `docs/plans/2026-03-06-review-pass3-tests.md`

**Step 1: Deduplicate and cross-reference**

A finding in Pass 1 (missing feature) may relate to Pass 2 (no implementation) and Pass 3 (no tests). Merge these into a single finding rather than listing three times.

**Step 2: Assign final severity**

Apply this heuristic:
- **P0:** Missing core feature, security vulnerability, auth bypass, data loss risk, test suite failing
- **P1:** Incomplete feature, poor error handling exposed to users, significant coverage gap in critical path
- **P2:** Code smell, weak assertion, untested utility, accessibility issue, tech debt

**Step 3: Write the report**

Save to `docs/plans/2026-03-06-codebase-review-report.md` with this structure:

```markdown
# Photowalker Codebase Review Report

**Date:** 2026-03-06
**Branch:** demo
**Reviewer:** Claude

---

## Executive Summary

[3-5 sentences: overall health, headline findings, recommendation]

---

## PRD Alignment

[Feature-by-feature status table]

### Gaps and Issues
[Findings from Pass 1, grouped by requirement ID]

---

## Code Quality

### Backend
[Findings from Pass 2, backend section]

### Frontend
[Findings from Pass 2, frontend section]

---

## Test Health

### Test Run Results
[Passed/failed counts from both suites]

### Test Quality Issues
[Findings from Pass 3, quality section]

### Coverage Gaps
[Untested modules table]

---

## Prioritized Action List

### P0 — Ship Blockers
[All P0 findings]

### P1 — Fix Soon
[All P1 findings]

### P2 — Tech Debt
[All P2 findings]
```

**Step 4: Commit the report**

```bash
git add docs/plans/2026-03-06-review-pass1-prd.md \
        docs/plans/2026-03-06-review-pass2-quality.md \
        docs/plans/2026-03-06-review-pass3-tests.md \
        docs/plans/2026-03-06-codebase-review-report.md
git commit -m "docs: add codebase review report (2026-03-06)"
```

---

## Execution Notes

- Tasks 1, 2, and 3 are fully independent — dispatch as parallel subagents
- Task 4 (synthesis) depends on all three completing — run in the main session after subagents finish
- If the backend DB is not running, unit tests can still run; note any integration test failures as infrastructure-dependent (not code bugs)
- The report is analysis only — no code changes
