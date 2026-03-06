# Codebase Review Pass 3 — Test Suite Analysis

**Date:** 2026-03-06
**Reviewer:** Claude (automated pass)
**Scope:** All test files, backend and frontend; coverage gap analysis

---

## Test Run Results

| Suite | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|
| Backend unit | 122 | 0 | 0 | 10.27s |
| Backend integration | not run — DB unavailable | — | — | — |
| Frontend (Vitest) | 89 (19 files) | 0 | 0 | 3.62s |

### Notable warnings from the test runs

**Backend unit:**
- `test_auth_service.py`: `RuntimeWarning: coroutine 'AsyncMockMixin._execute_mock_call' was never awaited` on `db.add(user)` in two tests. The mock for `db.add` is a plain `MagicMock`, not an `AsyncMock`, but the unit of work (session.add) is not async in SQLAlchemy — this warning likely comes from the `AsyncMock` on the session leaking into the add call. The practical risk is that the `db_session.add.assert_called_once()` assertion may pass vacuously without verifying the actual DB write path.
- `test_auth_service.py` and `test_jwt.py`: `InsecureKeyLengthWarning` — HMAC keys in tests are 11–23 bytes, below the 32-byte minimum for SHA-256. Acceptable in tests only; worth confirming production `SECRET_KEY` is adequately long.
- `test_factory.py` and `test_db_session.py`: `DeprecationWarning: on_event is deprecated` — the `create_app` factory uses `@app.on_event("startup")`, which FastAPI has deprecated in favour of `lifespan` handlers.

**Frontend:**
- `Browse.test.tsx` and `ExploreRoutesPanel.test.tsx`: multiple `act(...)` warnings — state updates triggered by async mocks are not wrapped in `act()`. Tests pass, but they may mask real timing bugs and could become flaky as React internals evolve.
- `Browse.test.tsx`: `HTMLCanvasElement.getContext() not implemented` in jsdom — map canvas rendering is unavailable. Map-layer behaviour (source/layer add, click handlers) is exercised only through mocked map objects; real rendering errors would not be caught.
- Several files: React Router v6→v7 future-flag warnings — minor, upgrade notices only.

---

## Test Quality Findings

### Backend unit tests

**[P0] test_placeholder.py — trivially true placeholder**
File: `backend/tests/unit/test_placeholder.py:4`
Fix: Remove the file entirely. It is the only test in the suite that asserts nothing real (`assert True`). It was left behind from scaffolding and inflates the pass count by one.

**[P1] test_auth_service.py — async mock mismatch on db.add may give false confidence**
File: `backend/tests/unit/test_auth_service.py:54`, `test_auth_service.py:75`
The `db_session` fixture is an `AsyncMock()`, which means every attribute access returns a new `AsyncMock`. Calling `db_session.add(user)` therefore returns a coroutine that is never awaited — the runtime warning confirms this. The assertion `db_session.add.assert_called_once()` passes, but because `add` is a coroutine mock the actual call semantics differ from the real `AsyncSession.add` (which is synchronous). The test can pass even if the implementation never calls `add`. Fix: use `MagicMock()` for the db session (since `session.add` is synchronous in SQLAlchemy async sessions) or use `AsyncMock(spec=AsyncSession)` to constrain the mock to the real interface.

**[P1] test_auth_service.py — refresh_tokens with expired token not tested**
File: `backend/tests/unit/test_auth_service.py`
`refresh_tokens` is tested for a valid token and for an invalid string, but there is no test for an expired refresh token. The jwt-layer tests (`test_jwt.py`) do cover expiry, but the service-level `refresh_tokens` function (which wraps the jwt call) does not have an explicit expiry test. Fix: add a test that issues a token with `refresh_days=-1` and asserts `refresh_tokens` returns `None`.

**[P1] test_rate_limit.py — upload and per-hour route limits not exercised**
File: `backend/tests/unit/test_rate_limit.py`
The test file verifies the IP-per-minute limit and skip paths, but the middleware also enforces `rate_limit_uploads_per_minute` (for `POST /v1/photos`) and `rate_limit_routes_per_hour` (for `POST /v1/routes`). Neither limit is tested. The settings fixture sets these values, but no test sends enough upload or route-creation requests to trip them. Fix: add tests for upload and route-creation rate limiting paths analogous to `test_rate_limit_returns_429_when_exceeded`.

**[P1] test_s3.py — get_file_content and get_presigned_url not tested**
File: `backend/tests/unit/test_s3.py`
`test_s3.py` covers `upload_file`, `delete_file`, and the key-format helpers, but two public functions — `get_file_content` and `get_presigned_url` — have no tests. `get_file_content` is called directly by `thumbnail_job.py`; a bug there (e.g., wrong path resolution or missing-file handling) would only surface at runtime. Fix: add local-storage tests for `get_file_content` (file exists, file missing → raises) and at minimum a test that `get_presigned_url` returns `None` when using local storage.

**[P1] test_discovery_service.py — all tests gated behind @requires_postgres**
File: `backend/tests/unit/test_discovery_service.py`
Every test in this file is decorated with `@requires_postgres`. In the unit test run (without a DB) all five tests are skipped silently. The discovery service business logic — public-only filter, bbox filter, tag AND logic, pagination — gets zero unit coverage when Postgres is unavailable. Fix: extract the pure-logic parts (bbox area validation, tag filtering SQL construction) into helpers and test those without a DB, or move all discovery tests to the integration suite where Postgres is expected.

**[P1] test_photo_service.py — same: all tests require Postgres, run as zero in unit suite**
File: `backend/tests/unit/test_photo_service.py`
Same situation as discovery: all 14 tests are `@requires_postgres`. The unit suite reports 0 tests from this file when no DB is present. The photo service contains the most complex business logic in the codebase (JPEG validation, EXIF extraction, S3 upload, ownership enforcement). Fix: mock the DB and storage layers to give at least 3–4 pure-logic tests that always run, and keep the Postgres-dependent tests in integration.

**[P1] test_route_service.py — same: all tests require Postgres**
File: `backend/tests/unit/test_route_service.py`
All 11 tests require Postgres. The `create_route_from_photos` ownership check and geometry recompute logic cannot be verified in CI without a DB. Fix: same as above — extract and mock-test the pure-logic portions.

**[P2] test_models.py — structural assertions check attribute existence, not column constraints**
File: `backend/tests/unit/test_models.py:21–46`
The six non-Postgres tests check that ORM relationships exist (e.g., `hasattr(User, 'routes')`), but not that the columns are typed correctly, not-null, indexed, or have the right FK relationship. These tests would pass even if the relationship was misconfigured as long as the attribute existed. Fix: at minimum add assertions on `back_populates` for each relationship, and/or check `Column.nullable`, `Column.type`.

**[P2] test_config.py — missing validation of invalid settings**
File: `backend/tests/unit/test_config.py`
The two existing tests verify happy-path loading and defaults. There are no tests for invalid values (e.g., empty `secret_key`, malformed `database_url`, negative `jwt_access_token_expire_minutes`). Fix: add at least one test that confirms `Settings(secret_key="")` raises a validation error.

**[P2] test_jwt.py — no test for tampered token (wrong signature)**
File: `backend/tests/unit/test_jwt.py`
Tests cover expiry and wrong token type, but not a JWT with a valid structure but wrong signature (e.g., signed with a different key). Fix: sign a token with `secret_key="other-key"` and assert decode returns `None`.

**[P2] test_thumbnail.py — no test for corrupt/non-JPEG input**
File: `backend/tests/unit/test_thumbnail.py`
`resize_to_thumbnail` is tested with valid JPEGs only. There is no test for what happens with `b"not-an-image"` input. Fix: add a test asserting that corrupt input raises a `PIL.UnidentifiedImageError` (or whatever the function wraps it as) so callers know what to catch.

**[P2] test_exif.py — missing sub-second / malformed datetime edge cases**
File: `backend/tests/unit/test_exif.py:79`
`extract_captured_at` is tested for the standard `YYYY:MM:DD HH:MM:SS` format but not for sub-second variants (`2023:06:15 14:30:00.5`) or clearly malformed values (`"not-a-date"`). Fix: add two parameterised cases — malformed string returns `None`; sub-second string is either parsed or returns `None` gracefully.

---

### Backend integration tests

**[P1] test_api_routes.py — no test for PATCH /v1/routes/{id} without auth (401)**
File: `backend/tests/integration/test_api_routes.py`
`PATCH /v1/routes/{id}` is tested for 403 (non-owner), but there is no test that sends the request with no auth header and asserts 401. The same gap exists for `DELETE /v1/routes/{id}`. Fix: add `test_patch_routes_without_auth_returns_401` and `test_delete_routes_without_auth_returns_401`.

**[P1] test_api_routes.py — no test for successful PATCH (owner updates own route)**
File: `backend/tests/integration/test_api_routes.py`
The happy path for route update (owner sends valid PATCH, gets 200 back with updated fields) is not covered. Only the 403 ownership-violation path is tested. Fix: add a test where the route owner sends `PATCH /v1/routes/{id}` and asserts 200 plus correct field updates.

**[P1] test_api_routes.py — no test for successful DELETE (owner deletes own route)**
File: `backend/tests/integration/test_api_routes.py`
Same gap as PATCH: only the non-owner 403 is tested. Fix: add a test where the owner sends `DELETE /v1/routes/{id}` and asserts 204/200 and the route is gone.

**[P1] test_api_photos.py — no test for POST /v1/photos without auth (401)**
File: `backend/tests/integration/test_api_photos.py`
Photo upload requires authentication, but there is no integration test that sends `POST /v1/photos` with no token and verifies 401. Fix: add `test_post_photos_without_auth_returns_401`.

**[P1] test_api_photos.py — no test for DELETE /v1/photos/{id} (owner success or 404)**
File: `backend/tests/integration/test_api_photos.py`
The delete endpoint is tested for ownership violation (403) only. There is no test for a successful delete (owner deletes their own photo, expects 200/204) or for deleting a non-existent photo (404). Fix: add both.

**[P1] test_api_photos.py — GET /v1/photos/my without auth (401) not tested**
File: `backend/tests/integration/test_api_photos.py`
`GET /v1/photos/my` is an auth-protected endpoint. The integration suite tests its bbox-too-large and invalid-bbox paths (which do require auth) but has no test that sends no token at all and expects 401. Fix: add `test_get_v1_photos_my_without_auth_returns_401`.

**[P1] test_api_discovery.py — no test for private route excluded from browse**
File: `backend/tests/integration/test_api_discovery.py`
The happy-path tests confirm public routes appear in browse results. There is no integration test asserting that a private route does NOT appear in `GET /v1/routes` (without auth or as a different user). Fix: create a private route as user1, then call `GET /v1/routes` as user2 (or unauthenticated) and confirm the private route is absent.

**[P2] test_auth_dependencies.py — only two tests, no test for expired token (401)**
File: `backend/tests/integration/test_auth_dependencies.py`
Tests cover missing token and invalid token. A valid-but-expired token is not tested separately at the integration layer. Fix: generate a token with `access_min=-1`, send it, assert 401.

**[P2] test_migrations.py — downgrade only tested by one level (-1)**
File: `backend/tests/integration/test_migrations.py`
`alembic downgrade -1` is tested but a full downgrade to base (`alembic downgrade base`) is not. If there are multiple migrations, a schema-breaking change in an older migration would go undetected. Fix: add `test_alembic_downgrade_base_succeeds` if feasible.

---

### Frontend tests

**[P0] App.test.tsx — placeholder test with `assert True` equivalent**
File: `frontend/src/App.test.tsx:6`
```typescript
it('placeholder', () => {
  expect(true).toBe(true);
});
```
This is a direct parallel to `test_placeholder.py` on the backend. The rest of the `App.test.tsx` tests are real (routing redirects), but the placeholder test itself contributes nothing and should be removed.

**[P1] useAuth hook — no unit tests**
File: `frontend/src/hooks/useAuth.ts`
`useAuth` is the most critical hook in the frontend: it initialises the session on mount by calling the refresh endpoint, sets access tokens, and gates all authenticated UI. It has non-trivial logic (singleton `initPromise`, skip-init paths for `/auth/callback` and `/login`, error handling that calls `clearUser`). It is used in every page and component that needs authentication, yet there is no test file for it. All tests that need `useAuth` mock the entire module (`vi.mock('../../hooks/useAuth')`), meaning the hook's actual logic is never exercised in any test. Fix: add `useAuth.test.ts` covering at minimum: session init success (refresh → getMe → sets user), refresh failure (clears user), skip on `/auth/callback`, and that `logout` calls the API then clears the store.

**[P1] useRoutes.ts — stub with empty body, no tests**
File: `frontend/src/hooks/useRoutes.ts`
The file contains `return {};` — it is an unfilled stub. If any component depends on this hook it will receive an empty object silently. Fix: either implement the hook and test it, or remove the file until it is needed.

**[P1] PhotoUploadForm — no tests**
File: `frontend/src/components/photos/PhotoUploadForm.tsx`
The photo upload form is the primary data-entry path for photos. File-type validation, caption input, route association, upload progress feedback, and error handling are all untested. Fix: add `PhotoUploadForm.test.tsx` covering: file type rejection (non-JPEG), successful upload call, caption field, and error display.

**[P1] CreateRoute page — no tests**
File: `frontend/src/pages/CreateRoute.tsx`
The create-route page is a protected, multi-step flow (draw on map, set metadata, submit). `RouteForm` has tests but the page wrapper that orchestrates the form, handles the API call result, navigates on success, and displays errors does not. Fix: add `CreateRoute.test.tsx` covering: redirect when unauthenticated, API success → navigate to route detail, API error → shows error message.

**[P1] ExploreRoutesPanel.test.tsx — act() warnings indicate async state not stabilised**
File: `frontend/src/components/explore/ExploreRoutesPanel.test.tsx`
Multiple `act(...)` warnings appear during this test file's run. The tests use `await screen.findByText(...)` in some places but not consistently after all state updates. The risk is that assertions run before React has flushed side effects, giving intermittent false passes. Fix: wrap all userEvent interactions and post-interaction assertions in `waitFor`, and ensure `getBrowseRoutes` mock resolution is awaited before asserting panel state.

**[P1] Browse.test.tsx — act() warnings and canvas mock limitation**
File: `frontend/src/pages/Browse.test.tsx`
Same act() issue. Additionally, `HTMLCanvasElement.getContext() not implemented` is thrown during the map-init path. The map object is fully mocked, so source/layer operations are no-ops. This means any bug in the Browse page's use of real MapLibre GL APIs (addSource, addLayer, addImage with real canvas) would not be caught. Fix: the act() warnings can be resolved by awaiting all state-triggering calls; the canvas limitation is inherent to jsdom and acceptable, but should be noted explicitly in a comment so future contributors don't mistake it for a test that validates rendering.

**[P2] Settings page — no tests**
File: `frontend/src/pages/Settings.tsx`
The settings page is untested. Fix: add `Settings.test.tsx` covering at minimum: renders without crashing, shows user info when authenticated, redirects when unauthenticated.

**[P2] WelcomeModal component — no dedicated tests (tested indirectly via Browse)**
File: `frontend/src/components/common/WelcomeModal.tsx`
The Welcome modal is tested through Browse page tests (show/hide/Escape), but the component itself has no unit test. If the modal is ever used elsewhere, its own behaviour is unverified in isolation. Fix: add `WelcomeModal.test.tsx` with direct render tests.

**[P2] Toast component — no tests**
File: `frontend/src/components/common/Toast.tsx`
The Toast component (used for user-facing error and success feedback throughout the app) has no test. Fix: add `Toast.test.tsx` covering: renders message, auto-dismiss after timeout, manual close.

**[P2] HighlightedRouteLayer — no tests**
File: `frontend/src/components/map/HighlightedRouteLayer.tsx`
This component drives the map highlight for route hover/selection — a core UX interaction in Browse. It has no test. Fix: mock the map object and assert the layer is added/removed and source data is updated when the highlighted route changes.

**[P2] MapPanel / MapShell — no tests**
Files: `frontend/src/components/map/MapPanel.tsx`, `frontend/src/components/map/MapShell.tsx`
Both layout components are untested. Fix: basic render tests to verify children mount and the correct DOM structure is produced.

**[P2] RouteDrawer — no tests**
File: `frontend/src/components/map/RouteDrawer.tsx`
The route-drawing tool is mocked in `RouteForm.test.tsx` but never tested directly. Any regression in how it emits coordinates or handles user interactions on the map would be invisible. Fix: add a test that mounts RouteDrawer with a mocked map and verifies it calls `onChange` with the drawn coordinates.

**[P2] authStore — logout action not tested through the store's own logout method**
File: `frontend/src/store/authStore.test.ts:40`
The store test calls `clearUser()` to simulate logout but does not test any `logout` action that may be defined on the store itself (the test comment even says "via clearUser"). If the store exposes a `logout` action that does additional work, that action is untested. Fix: verify the test covers whatever the canonical logout path is.

**[P2] api/routes.test.ts — getMyRoutes, deleteRoute, updateRoute not tested**
File: `frontend/src/api/routes.test.ts`
The routes API module likely exports `getMyRoutes`, `getRouteBySlug`, `updateRoute`, and `deleteRoute` (given the integration tests exercise all these endpoints). Only `createRoute`, `createRouteFromPhotos`, and `getBrowseRoutes` are covered. Fix: add tests for the remaining exported functions.

**[P2] api/photos.test.ts — deletePhoto, getPhotosInBbox, fetchPhotoImageBlob not tested**
File: `frontend/src/api/photos.test.ts`
The test covers `uploadPhoto`, `getPhotoImageUrl`, `getRoutePhotos`, and `updatePhoto`. The `deletePhoto`, `getPhotosInBbox`, and `fetchPhotoImageBlob` functions are used in production code (Browse.test.tsx mocks `getPhotosInBbox` and `fetchPhotoImageBlob`) but have no unit tests in the API layer. Fix: add tests for each.

**[P2] geometry.test.ts — missing empty array case**
File: `frontend/src/utils/geometry.test.ts`
`validateRouteGeometry` is tested for 2 valid points, 1 point (error), and 2 identical points (distance 0). An empty array `[]` is not tested. Fix: add `validateRouteGeometry([])` and assert it returns `valid: false`.

---

## Coverage Gaps

Modules with no test file whatsoever, or with a test file that does not exercise the module's logic:

| File | Type | Risk | Notes |
|---|---|---|---|
| `backend/app/workers/thumbnail_job.py` | Unit | High | Async RQ worker; `generate_thumbnail` logic (photo lookup, download, resize, upload, DB write, error paths) is completely untested. The individual utilities it calls (resize, upload) are tested, but the orchestration and error handling are not. |
| `backend/app/storage/s3.py` — `get_file_content` | Unit | High | Called by thumbnail_job; no test. Missing-file path would raise unhandled `FileNotFoundError` on local storage. |
| `backend/app/storage/s3.py` — `get_presigned_url` | Unit | Medium | Returns `None` on local storage; untested. Used by photo image serving. |
| `backend/app/storage/s3.py` — `check_s3_connection` | Unit | Medium | Health check function; only exercised indirectly through `test_health_storage_returns_200_or_503` which accepts either outcome. |
| `frontend/src/hooks/useAuth.ts` | Unit | High | Session init logic, singleton promise, skip paths, error clearing — all untested. Every component that calls `useAuth` mocks it entirely. |
| `frontend/src/hooks/useRoutes.ts` | Unit | Medium | Stub returning `{}`; file exists but has no implementation or tests. |
| `frontend/src/hooks/useMap.ts` | Unit | Medium | No test file found. |
| `frontend/src/hooks/usePreferredMapCenter.ts` | Unit | Medium | Mocked in multiple test files but never tested directly. |
| `frontend/src/hooks/useFocusTrap.ts` | Unit | Medium | Accessibility-critical hook; used by BottomDrawer. BottomDrawer is tested but the hook itself is not. |
| `frontend/src/contexts/MapContext.tsx` | Unit | Medium | Mocked in Browse and ExploreRoutesPanel tests; no unit test for the context provider itself. |
| `frontend/src/contexts/HighlightedRouteContext.tsx` | Unit | Low | Simple context; no test. |
| `frontend/src/contexts/RoutesPanelContext.tsx` | Unit | Low | Exercised indirectly through DrawerMenu test. No dedicated test. |
| `frontend/src/map/mapStyles.ts` | Unit | Low | Configuration object; no test. |
| `frontend/src/map/poiConfig.ts` | Unit | Low | Configuration object; no test. |
| `frontend/src/components/photos/PhotoUploadForm.tsx` | Unit | High | Primary upload path; no test. |
| `frontend/src/pages/CreateRoute.tsx` | Unit | High | Protected multi-step flow; no test. |
| `frontend/src/pages/Settings.tsx` | Unit | Medium | No test. |
| `frontend/src/components/common/WelcomeModal.tsx` | Unit | Low | Tested indirectly through Browse; no unit test. |
| `frontend/src/components/common/Toast.tsx` | Unit | Medium | Used for all user feedback; no test. |
| `frontend/src/components/map/HighlightedRouteLayer.tsx` | Unit | Medium | Core browse UX; no test. |
| `frontend/src/components/map/MapPanel.tsx` | Unit | Low | Layout component; no test. |
| `frontend/src/components/map/RouteDrawer.tsx` | Unit | Medium | Route-drawing tool; mocked in RouteForm tests but never tested directly. |
| `frontend/src/pages/AuthCallback.tsx` | Unit | Medium | OAuth callback handler; no test. |
| `frontend/src/pages/Login.tsx` | Unit | Low | Simple redirect page; no test. |
| `frontend/src/pages/NotFound.tsx` | Unit | Low | No test. |

---

## Summary by Priority

### P0 (ship blockers)
1. `test_placeholder.py` — trivially true assertion in the backend unit suite.
2. `App.test.tsx` — trivially true `placeholder` test in the frontend suite.

Both inflate reported pass counts and should be removed.

### P1 (important gaps)
3. `useAuth` hook has zero test coverage despite being the session-init backbone.
4. `PhotoUploadForm` has zero test coverage despite being the primary upload path.
5. `CreateRoute` page has zero test coverage.
6. `useRoutes.ts` is an unfilled stub.
7. `test_auth_service.py` — async mock mismatch may give false confidence on DB write path.
8. `test_rate_limit.py` — upload and per-hour route limits not exercised.
9. `test_s3.py` — `get_file_content` not tested (called by thumbnail worker).
10. Integration: PATCH/DELETE /v1/routes/{id} success paths (owner) not tested.
11. Integration: DELETE /v1/photos/{id} success and 404 paths not tested.
12. Integration: POST /v1/photos without auth (401) not tested.
13. Integration: GET /v1/photos/my without auth (401) not tested.
14. Integration: private route exclusion from `GET /v1/routes` not tested end-to-end.
15. All `test_discovery_service.py`, `test_photo_service.py`, `test_route_service.py` tests gated behind `@requires_postgres` — zero coverage in unit run.

### P2 (minor gaps)
16. `thumbnail_job.py` — orchestration logic entirely untested.
17. `get_presigned_url` / `check_s3_connection` in s3.py untested.
18. `Toast`, `WelcomeModal`, `HighlightedRouteLayer`, `RouteDrawer`, `MapPanel`, `Settings` — no tests.
19. `useFocusTrap`, `useMap`, `usePreferredMapCenter` hooks — no direct tests.
20. `api/routes.test.ts` and `api/photos.test.ts` — several exported functions untested.
21. `test_jwt.py` — tampered token not tested.
22. `test_thumbnail.py` — corrupt input not tested.
23. `test_config.py` — invalid settings not tested.
24. `geometry.test.ts` — empty array not tested.
25. Browse and ExploreRoutesPanel tests have unresolved `act()` warnings.
