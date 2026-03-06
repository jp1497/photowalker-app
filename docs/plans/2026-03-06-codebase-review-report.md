# Photowalker Codebase Review Report

**Date:** 2026-03-06
**Branch:** demo
**Scope:** PRD alignment, code quality, test coverage

---

## Executive Summary

The core photowalk experience — uploading photos, creating routes from them, browsing via map, and viewing route detail — is solidly implemented and all 211 automated tests pass (122 backend unit, 89 frontend). However, six PRD-required features are entirely absent from the backend: GPX export, bulk photo reorder on existing routes, remove-photo-from-route, and the full drafts workflow. Two security issues are ship-blockers: `SECRET_KEY` has no minimum-length guard (a weak secret makes all JWTs forgeable), and the health endpoints return raw exception messages to unauthenticated callers including database hostnames and S3 ARNs. Test depth is also a concern — three entire service modules (`route_service`, `photo_service`, `discovery_service`) are gated behind a Postgres requirement and get zero coverage in the unit run, and the most critical frontend hook (`useAuth`) has no tests at all. **Recommendation: address all P0 items before release; the app is otherwise close to beta-ready.**

---

## PRD Alignment

| Req ID | Description | Backend | Frontend | Status |
|--------|-------------|---------|----------|--------|
| FR1 | Auth — Google OAuth, JWT, refresh, sign out, `/auth/me` | Partial | — | ⚠ |
| FR2 | Route Creation — photo-first + draw-first | ✓ | ✓ | ✓ |
| FR3 | Photo Upload — JPEG, 10MB, EXIF GPS, S3, async thumbnail | ✓ | ✓ | ✓ |
| FR4 | Route Viewing — slug, polyline+pins, 404/403 | ✓ | ✓ | ✓ |
| FR5 | Route Browsing — bbox, tag/author, pagination, sort | ✓ | ✓ | ✓ |
| FR-R1 | Photo-first creation — EXIF auto-plot, place-on-map, drag reorder | ✓ | ✓ | ✓ |
| FR-R2 | Route–photo geometry consistency | ✓ | ✓ | ✓ |
| FR-R3 | Nullable location, `PATCH /photos/{id}`, recompute | ✓ | ✓ | ✓ |
| FR-R4/R8 | Thumbnail pins, fallback dot, clustering | ✓ | ✓ | ✓ |
| FR-R5/R6 | Bulk reorder + add/remove, publish guard | ✗ | ✗ | ✗ |
| FR-R7 | GPX export | ✗ | ✗ | ✗ |
| FR-R9 | Undo/Redo (Ctrl+Z, last 20 actions) | — | ✗ | ✗ |
| FR-R10 | Route Drafts — POST/GET/PATCH/DELETE `/drafts` | ✗ | ✗ | ✗ |
| FR-U1 | `/` → `/browse`; welcome modal (sessionStorage) | — | ✓ | ✓ |
| FR-U2 | Browse: photo pins only, pin click → lightbox | — | ✓ | ✓ |
| FR-U3 | Explore panel — All/My filter, Create button, hover highlights | — | ✓ | ✓ |
| FR-U4 | BottomDrawer peek+expand for route view and create | — | ✓ | ✓ |
| FR-U5 | Account icon: Sign in / Settings / Sign out only | — | ✓ | ✓ |
| FR-U6 | No `/routes/me` page; My routes as panel filter only | — | ✓ | ✓ |
| FR-U7 | Touch targets ≥44px, rem/% sizing | — | ✓ | ✓ |
| NFR3 | Rate limits — 100 anon, 500 auth, 10 uploads/min | ✓ | — | ✓ |
| NFR4 | JWT 15min, refresh 7d HTTP-only, CORS frontend only | Partial | — | ⚠ |
| NFR5 | ≥80% unit test coverage | Unknown | Unknown | ⚠ |

### PRD Gap Findings

**[P0] FR-R7: GPX export endpoint missing**
File: `backend/app/api/v1/routes.py`
`GET /v1/routes/{slug}/gpx` does not exist anywhere in the backend. No frontend export button either.
Fix: Add the endpoint returning `application/gpx+xml` with a track and photo waypoints; add export button to route detail view.

**[P0] FR-R5: Bulk reorder endpoint missing**
File: `backend/app/api/v1/routes.py`
`PATCH /v1/routes/{route_id}/photos/order` is absent. Photo order in an existing saved route cannot be persisted.
Fix: Add the endpoint, accepting an ordered list of `photo_id`s, and call `route_service` to update `display_order` and recompute geometry.

**[P0] FR-R6: Remove photo from route endpoint missing**
File: `backend/app/api/v1/routes.py`
`DELETE /v1/routes/{route_id}/photos/{photo_id}` does not exist. Only `DELETE /v1/photos/{id}` exists, which deletes the photo globally.
Fix: Add the endpoint to dissociate a photo from a route (delete from `route_photos`) without deleting the photo. Enforce the ≥2 photos publish guard on removal.

**[P0] FR-R10: Drafts endpoints missing**
File: `backend/app/core/factory.py`
No drafts router is registered. The `is_draft` column exists in the model and migration, but all four required endpoints (`POST`, `GET`, `PATCH .../publish`, `DELETE`) are unimplemented. No frontend draft save/list/publish flow either.
Fix: Implement a `drafts.py` router with the four required endpoints and register it in `factory.py`.

**[P1] FR1/NFR4: Sign-out does not server-side invalidate the refresh token**
File: `backend/app/api/v1/auth.py:163-171`
`POST /auth/logout` only clears the HTTP-only cookie. A stolen refresh token remains valid for 7 days after sign-out.
Fix: Implement server-side token revocation (e.g. a token revocation table or Redis blocklist checked in the refresh flow).

**[P1] FR-R9: Undo/Redo not implemented in create flow**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx`
No undo/redo stack, no Ctrl+Z / Ctrl+Shift+Z keyboard handler, no history management.
Fix: Implement a `useUndoRedo` hook over the `photos` state array.

**[P1] FR-R5/R6: No frontend UI for reorder/add/remove on existing saved routes**
No component exists to edit a route's photo list after initial creation.
Fix: Build a photo management panel for the route detail/edit view.

**[P2] FR-R4/R8: Cluster count badge not rendered for photo pins on browse map**
File: `frontend/src/pages/Browse.tsx`
Photo clusters show stacked thumbnails but no numeric count badge as required by the PRD.
Fix: Add a count label element to `createRouteClusterStackElement`.

**[P2] FR-U7: AccountIcon touch target is 40px, below the 44px minimum**
File: `frontend/src/components/common/AccountIcon.tsx:42-56`
`triggerStyle` sets `width: 40, height: 40`. PRD requires ≥44px.
Fix: Increase to `44px` or add padding.

**[P2] API: `GET /v1/photos/my` and `GET /v1/routes/me` not in PRD**
Files: `backend/app/api/v1/photos.py:119-177`, `backend/app/api/v1/routes.py:76-85`
Both endpoints exist and function correctly but are not in the PRD API table, adding unreviewed surface area.
Fix: Document in PRD or remove.

**[P2] MapShell: `explore-route-highlight` missing from `MapShellMode` type**
File: `frontend/src/components/map/MapShell.tsx:13`
The type contains `browse`, `browse-photos`, `detail`, `create`, `home` but is missing `explore-route-highlight` (from PRD) and includes undocumented values.
Fix: Align the type with the PRD's four modes.

---

## Code Quality

### Backend — Security

**[P0] SECRET_KEY has no minimum-length or non-default validation**
File: `backend/app/core/config.py:26`
A weak or default secret key makes all JWTs forgeable.
Fix: Add a Pydantic `@model_validator` that raises `ValueError` if `secret_key` is empty, shorter than 32 characters, or matches a known placeholder (`"changeme"`, `"secret"`).

**[P0] /health/db leaks raw exception message to unauthenticated callers**
File: `backend/app/api/v1/health.py:32-37`
`"error": str(e)` in the 503 body can expose internal DB hostnames, driver errors, and schema details.
Fix: Log the exception server-side; return a generic `"database": "disconnected"` without the error string.

**[P0] /health/storage leaks raw exception message to unauthenticated callers**
File: `backend/app/api/v1/health.py:47-54`
Same pattern — S3 SDK errors can include bucket names, IAM ARNs, and region details.
Fix: Same as above.

**[P1] Refresh cookie `secure` flag is `False` in non-production environments**
File: `backend/app/api/v1/auth.py:72`
On staging the refresh token is sent over plain HTTP, exposing it to network interception.
Fix: Enable `secure=True` for `staging` as well, or set it based on protocol rather than environment name.

**[P1] `X-Forwarded-For` uses rightmost (proxy) IP instead of leftmost (client) IP**
File: `backend/app/middleware/rate_limit.py:76-82`
`split(",")[-1]` takes the proxy's IP, making per-IP rate limiting ineffective behind a load balancer — all users share one bucket.
Fix: Use `split(",")[0].strip()` (leftmost), or trust a configured number of hops from the right.

**[P1] `test-login` endpoint is always registered regardless of `e2e_test_secret` config**
File: `backend/app/api/v1/auth.py:80-116`
The route is always listed in the OpenAPI schema and discoverable via port scanning. It only rejects wrong secrets at runtime.
Fix: Only `include_router` the endpoint when `settings.e2e_test_secret` is set.

### Backend — Error Handling

**[P1] S3 delete errors silently swallowed on `delete_photo`**
File: `backend/app/services/photo_service.py:345-353`
Both `delete_file` calls are wrapped in `except: pass`. If S3 delete fails, the DB row is deleted but the S3 object persists, with no indication to the caller or operator.
Fix: At minimum, log at `WARNING` level; ideally surface as a typed error.

**[P1] Thumbnail worker: PIL `Image.open` unguarded against corrupt images**
File: `backend/app/utils/thumbnail.py:20`
`PIL.UnidentifiedImageError` or `DecompressionBomb` on corrupt input causes infinite RQ retries.
Fix: Catch `(PIL.UnidentifiedImageError, PIL.Image.DecompressionBombError)` and mark the job permanently failed.

### Backend — Data Integrity

**[P2] `RouteResponse.is_draft` has a hardcoded default `= False`**
File: `backend/app/schemas/route.py:108`
The default silently masks truthy `is_draft` DB values if ORM binding fails.
Fix: Verify the field resolves from the ORM via `from_attributes`; remove the default.

**[P2] `Photo.captured_at` stored as timezone-naive datetime despite `DateTime(timezone=True)` column**
File: `backend/app/utils/exif.py:76`
EXIF `DateTimeOriginal` has no timezone; the code assumes UTC but doesn't document or enforce it.
Fix: Store as `None` or explicitly document the UTC assumption; strip `DateTime(timezone=True)` if not usable.

**[P2] `User.default_map_lat/lon` have no range constraints**
File: `backend/app/models/user.py:30-31`
A client could store `lat=999`. Add `ge=-90, le=90` / `ge=-180, le=180` to `UserUpdate` and consider a PostgreSQL `CHECK` constraint.

### Backend — Architecture

**[P1] `@app.on_event("startup"/"shutdown")` is deprecated**
File: `backend/app/core/factory.py:42-54`
Deprecated in FastAPI 0.93+; will eventually stop working.
Fix: Migrate to `@asynccontextmanager` lifespan.

**[P2] `_bbox_area_m2` duplicated across `discovery_service` and `photo_service`**
Files: `backend/app/services/discovery_service.py:33-40`, `backend/app/services/photo_service.py:135-142`
Fix: Extract to `utils/geometry.py` where the rest of the spatial helpers live.

**[P2] `auth_service.logout()` is a no-op (dead code)**
File: `backend/app/services/auth_service.py:74-76`
`def logout() -> None: pass` — never called; cookie deletion happens in the API layer directly.
Fix: Remove.

**[P2] `ensure_unique_slug` (sync variant) is dead code**
File: `backend/app/utils/slug.py:35-53`
All callers use `ensure_unique_slug_async`. Fix: Remove or document.

**[P2] `photo_service` imports from the `schemas` layer**
File: `backend/app/services/photo_service.py:278`
`from app.schemas.photo import _validate_geojson_point` inverts the normal dependency direction.
Fix: Move the validation helper to `utils/` or inline it in the service.

### Backend — Rate Limiting

**[P1] In-memory rate limit store is per-process**
File: `backend/app/middleware/rate_limit.py:64-72`
Under multi-worker deployments, the effective limit is `rate_limit × num_workers`. The code notes this but marks Redis as optional.
Fix: Require `redis_url` in non-development environments and enforce the Redis store path in production.

### Frontend — API Error Handling

**[P1] `refreshPromise` race window for concurrent 401s**
File: `frontend/src/api/client.ts:60-79`
Between `isRefreshing = true` and `refreshPromise = (async () => {...})()`, a second 401 can `await undefined`.
Fix: Set `isRefreshing = true` and `refreshPromise = ...` in the same synchronous block.

**[P1] `handleListPageChange` in `Browse.tsx` has no `.catch()`**
File: `frontend/src/pages/Browse.tsx:784-795`
API failure is silent — `routes` retains stale data and no error is shown.
Fix: Add `.catch()` that clears routes and/or shows a toast.

**[P1] `refetch()` in `RouteDetail.tsx` has no error handling**
File: `frontend/src/pages/RouteDetail.tsx:70-73`
Unhandled promise rejection on network error after a location save.
Fix: Add `.catch()`.

### Frontend — Type Safety

**[P1] No runtime validation of API responses**
File: `frontend/src/api/client.ts`, `routes.ts`, `photos.ts`, `auth.ts`
All responses use TypeScript generic casts only. Backend schema changes will silently produce `undefined` fields.
Fix: Add Zod schemas for `User`, `Route`, and `Photo` at minimum; validate on receipt.

**[P2] `Route` type missing `is_draft` field**
File: `frontend/src/types/route.ts:33-47`
The backend `RouteResponse` includes `is_draft: bool`; the frontend type omits it. Draft-status UI would silently treat all routes as non-draft.
Fix: Add `is_draft: boolean` to the `Route` type.

### Frontend — Auth / State

**[P1] `initPromise` is module-level — persists across logout/re-login in the same session**
File: `frontend/src/hooks/useAuth.ts:6`
After logout + re-login, `initPromise` is already resolved so session re-init on the next mount is skipped entirely.
Fix: Clear `initPromise` on `clearUser()` or move it inside the store.

**[P1] `clearUser()` does not invalidate component-level cached route/photo data**
File: `frontend/src/store/authStore.ts:22`
On user switch, the previous user's data can persist in component `useState` until unmount.
Fix: Add a global cache invalidation mechanism or a session key to key all component state.

### Frontend — Component Quality

**[P1] `Browse.tsx` is 958 lines mixing five distinct concerns**
File: `frontend/src/pages/Browse.tsx`
API fetching, map layer management, cluster marker DOM management, thumbnail blob loading, and lightbox state are all in one component.
Fix: Extract `useBrowseRoutes`, `useBrowsePhotos`, and `useClusterMarkers` hooks; keep `Browse` as a thin coordinator.

**[P1] `ErrorBoundary` renders raw stack trace to end users in production**
File: `frontend/src/components/common/ErrorBoundary.tsx:44-49`
`this.state.error.stack` includes file paths and line numbers.
Fix: Guard the `<details>` block with `process.env.NODE_ENV === 'development'` or omit in production builds.

**[P2] `Settings.tsx` is a placeholder stub**
File: `frontend/src/pages/Settings.tsx`
Reachable from the account dropdown; shows "Settings page coming soon." with no content.
Fix: Add meaningful content or redirect to a real destination.

**[P2] `useRoutes.ts` and `useMap.ts` are empty stubs**
File: `frontend/src/hooks/useRoutes.ts`, `frontend/src/hooks/useMap.ts`
Both return `{}`. Empty exported hooks create false confidence that shared logic is being reused.
Fix: Implement or remove.

**[P2] Photo upload is sequential — slow for multiple files**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx:173-185`
10 photos upload one at a time. Fix: Use `Promise.allSettled` with a concurrency limit (e.g. 3).

### Frontend — Accessibility

**[P1] Cluster markers are `aria-hidden` but interactive**
File: `frontend/src/pages/Browse.tsx:124`
`aria-hidden="true"` on clickable cluster markers makes them completely inaccessible to keyboard/screen reader users.
Fix: Add `role="button"`, `aria-label` (e.g. "3 routes in this area"), and keyboard focus.

**[P1] Drag-and-drop photo reorder has no keyboard alternative**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx:554-558`
WCAG 2.1 SC 2.1.1 failure — mouse-only reorder.
Fix: Add up/down arrow key handlers for reorder.

**[P2] Modal backdrop in `RouteDetail` only clears error state, not `editingPhotoId`**
File: `frontend/src/pages/RouteDetail.tsx:246`
Clicking the backdrop clears `editLocationError` but the modal remains open. Functional bug with accessibility impact.
Fix: Also call `setEditingPhotoId(null)` in the backdrop click handler.

**[P2] Map/List toggle buttons have no `aria-pressed` state**
File: `frontend/src/pages/Browse.tsx:891-916`
Visual active state via `fontWeight` only; screen readers cannot determine the selected mode.
Fix: Add `aria-pressed={viewMode === 'map'}` and `aria-pressed={viewMode === 'list'}`.

---

## Test Health

### Test Run Results

| Suite | Passed | Failed | Skipped | Notes |
|-------|--------|--------|---------|-------|
| Backend unit | 122 | 0 | 0 | 35 warnings |
| Backend integration | not run | — | — | Requires running Postgres |
| Frontend (Vitest) | 89 | 0 | 0 | 19 files, 3.62s |

**Backend unit warnings:**
- `test_auth_service.py`: `RuntimeWarning: coroutine '…_execute_mock_call' was never awaited` — async mock mismatch, assertions may pass vacuously
- `test_auth_service.py` / `test_jwt.py`: `InsecureKeyLengthWarning` on 11–23 byte HMAC keys — acceptable in tests, but confirm production `SECRET_KEY` is ≥32 bytes
- `test_factory.py` / `test_db_session.py`: `DeprecationWarning: on_event is deprecated`

**Frontend warnings:**
- `Browse.test.tsx` / `ExploreRoutesPanel.test.tsx`: multiple `act(...)` warnings — state updates not wrapped, tests could be flaky as React internals evolve
- `Browse.test.tsx`: `HTMLCanvasElement.getContext() not implemented` — map rendering not exercised in jsdom (known limitation)
- Several files: React Router v6→v7 future-flag warnings (upgrade notices, not bugs)

### Test Quality Findings

**[P1] `test_placeholder.py` — trivially true assertion (`assert True`)**
File: `backend/tests/unit/test_placeholder.py:4`
Scaffolding leftover that inflates the pass count and should be removed.

**[P1] `App.test.tsx` — placeholder test (`expect(true).toBe(true)`)**
File: `frontend/src/App.test.tsx:6`
Same issue on the frontend. The other tests in this file are real; remove just the placeholder.

**[P1] `test_auth_service.py` — async mock mismatch on `db.add`**
File: `backend/tests/unit/test_auth_service.py:54, 75`
`db_session` is an `AsyncMock`; `session.add` is synchronous in SQLAlchemy, so `db_session.add(user)` returns an unawaited coroutine. `assert_called_once()` can pass vacuously without verifying the real DB write path.
Fix: Use `MagicMock()` for the session or `AsyncMock(spec=AsyncSession)`.

**[P1] `test_rate_limit.py` — upload and per-hour route limits never triggered**
File: `backend/tests/unit/test_rate_limit.py`
The `rate_limit_uploads_per_minute` and `rate_limit_routes_per_hour` limits are configured but no test sends enough requests to trip them.
Fix: Add test cases analogous to the existing 429 test for each limit.

**[P1] `test_s3.py` — `get_file_content` not tested**
File: `backend/tests/unit/test_s3.py`
`get_file_content` is called by `thumbnail_job.py` and is completely untested. Missing-file handling would only surface at runtime.
Fix: Add tests for file-exists and file-missing paths.

**[P1] All `test_discovery_service`, `test_photo_service`, `test_route_service` tests gated behind `@requires_postgres`**
These three files contain the most complex business logic and get **zero coverage** in the unit run (no DB = all tests skipped silently).
Fix: Extract pure-logic portions and test them with mocked DB; keep Postgres-dependent tests in integration.

**[P1] Integration: success paths for `PATCH` and `DELETE /v1/routes/{id}` (owner) not tested**
File: `backend/tests/integration/test_api_routes.py`
Only the 403 (non-owner) case is tested for both endpoints.
Fix: Add owner-success tests for both.

**[P1] Integration: `DELETE /v1/photos/{id}` success and 404 paths not tested**
File: `backend/tests/integration/test_api_photos.py`
Only the 403 case is tested.
Fix: Add success and 404 tests.

**[P1] Integration: `POST /v1/photos` without auth (401) not tested**
Fix: Add `test_post_photos_without_auth_returns_401`.

**[P1] Integration: `GET /v1/photos/my` without auth (401) not tested**
Fix: Add `test_get_v1_photos_my_without_auth_returns_401`.

**[P1] Integration: private route exclusion from `GET /v1/routes` not tested end-to-end**
File: `backend/tests/integration/test_api_discovery.py`
No test confirms a private route is absent from public browse results.
Fix: Create private route as user1; call `GET /v1/routes` as user2 and assert it is absent.

**[P1] `useAuth` hook has zero test coverage**
File: `frontend/src/hooks/useAuth.ts`
The session-init hook with singleton `initPromise`, skip-on-callback path, and error clearing is entirely unmocked. Every test that touches it mocks the whole module.
Fix: Add `useAuth.test.ts` covering: init success, refresh failure, skip on `/auth/callback`, and logout flow.

**[P1] `PhotoUploadForm` has zero test coverage**
File: `frontend/src/components/photos/PhotoUploadForm.tsx`
Primary data-entry path for photos — file-type validation, caption, upload progress, error handling — all untested.
Fix: Add `PhotoUploadForm.test.tsx`.

**[P1] `CreateRoute` page has zero test coverage**
File: `frontend/src/pages/CreateRoute.tsx`
Protected multi-step flow; no test.
Fix: Add `CreateRoute.test.tsx` covering: auth redirect, success navigation, error display.

**[P1] `Browse.test.tsx` / `ExploreRoutesPanel.test.tsx` — unresolved `act()` warnings**
Async state updates not wrapped; tests could mask real timing bugs and become flaky.
Fix: Wrap all userEvent interactions and post-interaction assertions in `waitFor`.

### Coverage Gaps

| File | Risk | Notes |
|------|------|-------|
| `backend/app/workers/thumbnail_job.py` | High | Orchestration (photo lookup → download → resize → upload → DB write → error paths) entirely untested |
| `backend/app/storage/s3.py` — `get_file_content` | High | Called by thumbnail worker; missing-file path untested |
| `backend/app/storage/s3.py` — `get_presigned_url` | Medium | Returns `None` on local storage; untested |
| `frontend/src/hooks/useAuth.ts` | High | Session-init backbone; every consumer mocks it entirely |
| `frontend/src/hooks/useRoutes.ts` | Medium | Stub returning `{}`; no implementation or tests |
| `frontend/src/hooks/useMap.ts` | Medium | No test file |
| `frontend/src/hooks/usePreferredMapCenter.ts` | Medium | Mocked everywhere; never tested directly |
| `frontend/src/hooks/useFocusTrap.ts` | Medium | Accessibility-critical; used by BottomDrawer — untested |
| `frontend/src/components/photos/PhotoUploadForm.tsx` | High | Primary upload path; no test |
| `frontend/src/pages/CreateRoute.tsx` | High | Protected multi-step flow; no test |
| `frontend/src/components/map/HighlightedRouteLayer.tsx` | Medium | Core browse UX; no test |
| `frontend/src/components/map/RouteDrawer.tsx` | Medium | Route-drawing tool; mocked in RouteForm tests, never tested directly |
| `frontend/src/pages/AuthCallback.tsx` | Medium | OAuth callback handler; no test |
| `frontend/src/components/common/Toast.tsx` | Medium | Used for all user feedback; no test |
| `frontend/src/pages/Settings.tsx` | Medium | No test |
| `frontend/src/contexts/MapContext.tsx` | Medium | Mocked in Browse/ExploreRoutesPanel tests; no provider test |
| `frontend/src/components/common/WelcomeModal.tsx` | Low | Tested indirectly via Browse; no unit test |
| `frontend/src/components/map/MapPanel.tsx` | Low | Layout component; no test |
| `frontend/src/pages/Login.tsx` | Low | Simple redirect; no test |
| `frontend/src/pages/NotFound.tsx` | Low | No test |

---

## Prioritized Action List

### P0 — Ship Blockers (must fix before release)

1. **SECRET_KEY weak validation** — `backend/app/core/config.py:26` — Add min-length and non-default validation; a weak secret makes all JWTs forgeable.
2. **Health endpoints leak internals** — `backend/app/api/v1/health.py:32-54` — Remove `"error": str(e)` from both `/health/db` and `/health/storage` 503 responses; log server-side only.
3. **GPX export missing** — No backend endpoint, no frontend button — Implement `GET /v1/routes/{slug}/gpx` + export action in route detail view.
4. **Bulk reorder endpoint missing** — `PATCH /v1/routes/{route_id}/photos/order` not implemented — Required for persisting photo order on existing routes.
5. **Remove-photo-from-route endpoint missing** — `DELETE /v1/routes/{route_id}/photos/{photo_id}` not implemented — Required to dissociate a photo without deleting it globally.
6. **Drafts endpoints missing** — All four `/v1/drafts` endpoints unimplemented — `is_draft` model/migration exists but no API surface or frontend flow.

### P1 — Fix Soon (important, address shortly after release)

7. Sign-out does not server-side invalidate the refresh token — `backend/app/api/v1/auth.py:163-171`
8. Refresh cookie `secure=False` on staging — `backend/app/api/v1/auth.py:72`
9. `X-Forwarded-For` uses rightmost IP — rate limiting ineffective behind load balancer — `backend/app/middleware/rate_limit.py:76-82`
10. `test-login` endpoint always registered in OpenAPI — `backend/app/api/v1/auth.py:80-116`
11. S3 delete errors silently swallowed — `backend/app/services/photo_service.py:345-353`
12. Thumbnail worker crashes on corrupt images — infinite RQ retries — `backend/app/utils/thumbnail.py:20`
13. In-memory rate limit store per-process — Redis required in production — `backend/app/middleware/rate_limit.py:64-72`
14. Deprecated `@app.on_event` — migrate to lifespan — `backend/app/core/factory.py:42-54`
15. `refreshPromise` race window for concurrent 401s — `frontend/src/api/client.ts:60-79`
16. `Browse.tsx` pagination has no `.catch()` — `frontend/src/pages/Browse.tsx:784-795`
17. `RouteDetail.tsx` refetch has no error handling — `frontend/src/pages/RouteDetail.tsx:70-73`
18. No runtime validation of API responses — `frontend/src/api/client.ts` et al.
19. `initPromise` persists across logout/re-login — `frontend/src/hooks/useAuth.ts:6`
20. `clearUser()` doesn't clear component-level cached data — `frontend/src/store/authStore.ts:22`
21. `Browse.tsx` is 958 lines — extract into hooks — `frontend/src/pages/Browse.tsx`
22. `ErrorBoundary` renders raw stack trace in production — `frontend/src/components/common/ErrorBoundary.tsx:44-49`
23. Cluster markers `aria-hidden` but interactive — WCAG failure — `frontend/src/pages/Browse.tsx:124`
24. Drag-and-drop reorder has no keyboard alternative — WCAG 2.1.1 failure — `frontend/src/pages/CreateRouteFromPhotos.tsx:554-558`
25. Undo/Redo not implemented in create flow — `frontend/src/pages/CreateRouteFromPhotos.tsx`
26. No frontend UI for editing photos on existing routes
27. `test_placeholder.py` — remove — `backend/tests/unit/test_placeholder.py`
28. `App.test.tsx` placeholder — remove — `frontend/src/App.test.tsx:6`
29. `test_auth_service.py` async mock mismatch — `backend/tests/unit/test_auth_service.py:54, 75`
30. `test_rate_limit.py` upload and route limits not tested — `backend/tests/unit/test_rate_limit.py`
31. `test_s3.py` `get_file_content` not tested — `backend/tests/unit/test_s3.py`
32. Service tests all gated behind `@requires_postgres` — `test_discovery_service`, `test_photo_service`, `test_route_service`
33. Integration: PATCH/DELETE `/routes/{id}` success paths not tested
34. Integration: DELETE `/photos/{id}` success and 404 not tested
35. Integration: POST `/photos` without auth (401) not tested
36. Integration: GET `/photos/my` without auth (401) not tested
37. Integration: private route exclusion from `GET /v1/routes` not tested
38. `useAuth` hook has zero test coverage — `frontend/src/hooks/useAuth.ts`
39. `PhotoUploadForm` has zero test coverage — `frontend/src/components/photos/PhotoUploadForm.tsx`
40. `CreateRoute` page has zero test coverage — `frontend/src/pages/CreateRoute.tsx`
41. `Browse.test.tsx` / `ExploreRoutesPanel.test.tsx` `act()` warnings unresolved

### P2 — Tech Debt (address eventually)

42. Cluster count badge not rendered for photo pin clusters — `frontend/src/pages/Browse.tsx`
43. `AccountIcon` touch target 40px, below 44px minimum — `frontend/src/components/common/AccountIcon.tsx:42-56`
44. `GET /v1/photos/my` and `GET /v1/routes/me` undocumented in PRD — document or remove
45. MapShell mode type misaligned with PRD — `frontend/src/components/map/MapShell.tsx:13`
46. `RouteResponse.is_draft` hardcoded default `= False` — `backend/app/schemas/route.py:108`
47. `Photo.captured_at` timezone-naive datetime — `backend/app/utils/exif.py:76`
48. `User.default_map_lat/lon` no range constraints — `backend/app/models/user.py:30-31`
49. `_bbox_area_m2` duplicated across services — extract to `utils/geometry.py`
50. `auth_service.logout()` dead code — `backend/app/services/auth_service.py:74-76`
51. `ensure_unique_slug` sync variant dead code — `backend/app/utils/slug.py:35-53`
52. `photo_service` imports from `schemas` layer — invert to `utils/`
53. `boto3` client created on every S3 call — no connection reuse — `backend/app/storage/s3.py`
54. Rate limit skip too broad for dev + e2e_test_secret — `backend/app/middleware/rate_limit.py:146-148`
55. `Route` frontend type missing `is_draft` field — `frontend/src/types/route.ts`
56. `Photo.location.coordinates` typed as `number[]` not `[number, number]` — `frontend/src/types/photo.ts`
57. `Settings.tsx` is a placeholder stub — `frontend/src/pages/Settings.tsx`
58. `useRoutes.ts` and `useMap.ts` are empty stubs — implement or remove
59. Photo upload is sequential — use `Promise.allSettled` with concurrency limit
60. Modal backdrop in `RouteDetail` clears only error, not `editingPhotoId` (modal stays open) — `frontend/src/pages/RouteDetail.tsx:246`
61. Map/List toggle buttons no `aria-pressed` — `frontend/src/pages/Browse.tsx:891-916`
62. No CI coverage gate for ≥80% unit coverage threshold
63. `thumbnail_job.py` orchestration logic entirely untested
64. `get_presigned_url` / `check_s3_connection` in `s3.py` untested
65. `Toast`, `WelcomeModal`, `HighlightedRouteLayer`, `RouteDrawer` — no tests
66. `useFocusTrap`, `useMap`, `usePreferredMapCenter` — no direct tests
67. `api/routes.test.ts` — `getMyRoutes`, `deleteRoute`, `updateRoute` untested
68. `api/photos.test.ts` — `deletePhoto`, `getPhotosInBbox`, `fetchPhotoImageBlob` untested
69. `test_jwt.py` — tampered token (wrong signature) not tested
70. `test_thumbnail.py` — corrupt input not tested
71. `test_config.py` — invalid settings (empty `secret_key`) not tested
72. `geometry.test.ts` — empty array not tested for `validateRouteGeometry`
73. `auth_dependencies.py` — expired token not tested at integration layer
