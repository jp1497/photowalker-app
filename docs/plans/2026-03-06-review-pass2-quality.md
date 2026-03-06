# Photowalker — Pass 2 Code Quality Review
**Date:** 2026-03-06
**Scope:** Backend (FastAPI/Python) and Frontend (React/TypeScript)
**Reviewer:** Claude Code (automated static analysis)

---

## 1. Backend — Security

**[P0] auth: `SECRET_KEY` has no minimum-length or non-default validation**
File: `backend/app/core/config.py:26`
Fix: Add a Pydantic `@model_validator` (or `@field_validator`) that raises `ValueError` if `secret_key` is empty, shorter than 32 characters, or matches a known placeholder (e.g. `"changeme"`, `"secret"`). A short or default secret makes all JWTs forgeable.

**[P0] health: `/health/db` leaks raw exception message to HTTP response**
File: `backend/app/api/v1/health.py:32-37`
Fix: Log the exception server-side and return a generic `"database": "disconnected"` message without the `"error": str(e)` field in the 503 body. The current code can expose internal DB hostnames, driver errors, and schema details to unauthenticated callers.

**[P0] health: `/health/storage` leaks raw exception message to HTTP response**
File: `backend/app/api/v1/health.py:47-54`
Fix: Same as above — remove `"error": str(e)` from the 503 body. S3 SDK errors can include bucket names, IAM ARNs, and region details.

**[P1] auth: `secure` cookie flag is `False` in non-production environments**
File: `backend/app/api/v1/auth.py:72`
Fix: The refresh cookie is set with `secure=settings.environment == "production"`. In a staging environment (a common intermediary) the cookie is sent over plain HTTP, exposing the refresh token to network interception. Consider also enabling `secure` for `staging`.

**[P1] rate_limit: `X-Forwarded-For` uses rightmost entry (not leftmost)**
File: `backend/app/middleware/rate_limit.py:76-82`
Fix: `forwarded.split(",")[-1].strip()` takes the rightmost value. Standard practice behind a trusted reverse proxy is to use the leftmost value (`split(",")[0].strip()`) — the rightmost value is the one added by the proxy itself (often the internal load-balancer IP). Using the rightmost value means all users behind the same proxy share one IP bucket, making the per-IP limit effectively useless. Use the leftmost value, or trust only a configured number of hops from the right.

**[P1] auth: `test-login` endpoint is always registered regardless of `e2e_test_secret`**
File: `backend/app/api/v1/auth.py:80-116`
Fix: The endpoint is mounted unconditionally in `factory.py`. It only rejects wrong secrets at runtime, but the route is always listed in the OpenAPI schema and discoverable via port scanning. Guard registration: only `include_router` (or include the endpoint) when `settings.e2e_test_secret` is set.

**[P2] s3: boto3 client created on every call — no connection reuse**
File: `backend/app/storage/s3.py:35-41, 66-70, 86-91, 103-108, 123-128`
Fix: Each `upload_file`, `delete_file`, `get_file_content`, and `get_presigned_url` call creates a fresh `boto3.client(...)`. In a hot upload path this adds ~10-50 ms of TLS handshake overhead per call. Use a module-level cached client or pass a client instance in.

---

## 2. Backend — Error Handling

**[P1] photo_service: S3 upload failure before DB insert leaves no record, but silently succeeds if S3 is down**
File: `backend/app/services/photo_service.py:65`
Fix: `upload_file(settings, key_original, ...)` is called before `db.add(photo)`. If S3 raises, the function raises and no DB row is written — good. However there is no explicit `except` to re-wrap the S3 error into a typed application exception. An S3 `ClientError` or `ValueError` propagates as a bare exception, which the general 500 handler catches but returns a generic message. Wrap in a typed `StorageError` (add to `core/exceptions.py`) for better operational observability.

**[P1] photo_service: S3 delete errors are silently swallowed on `delete_photo`**
File: `backend/app/services/photo_service.py:345-353`
Fix: Both `delete_file` calls are wrapped in bare `except: pass`. If the S3 delete fails (e.g. permissions issue) the DB row is still deleted, leaving orphaned objects in S3 and no indication to the caller or operator. At minimum, log the exception at `WARNING` level. Ideally, surface S3 delete failures to the caller with a 500 so operations can investigate.

**[P1] thumbnail_job: PIL `Image.open` is not guarded against corrupt/non-JPEG data**
File: `backend/app/utils/thumbnail.py:20`
Fix: `Image.open(BytesIO(image_bytes))` will raise `PIL.UnidentifiedImageError` (or `DecompressionBomb`) on corrupt or specially crafted images. These exceptions are not caught in `generate_thumbnail`. RQ will retry the job indefinitely. Add a `try/except (PIL.UnidentifiedImageError, PIL.Image.DecompressionBombError)` and mark the job as permanently failed rather than retrying.

**[P2] error_handler: `Exception` catch-all masks `SystemExit` and `KeyboardInterrupt`**
File: `backend/app/middleware/error_handler.py:73`
Fix: `@app.exception_handler(Exception)` in Starlette/FastAPI also catches `BaseException` subclasses such as `SystemExit` and `KeyboardInterrupt` during request handling. Use `except Exception` explicitly (not `BaseException`) — this is already done in the handler body but double-check that Starlette's routing layer propagates `BaseException` before reaching this handler.

**[P2] discovery.py: redundant `bbox is not None` check**
File: `backend/app/api/v1/discovery.py:49`
Fix: The condition `if bbox is not None and bbox_tuple is None:` (line 49) is inside a block that already checked `if bbox is not None:` (line 47). The inner `bbox is not None` guard is redundant — minor readability issue.

---

## 3. Backend — Data Integrity

**[P2] model: `User.default_map_lat` / `default_map_lon` have no range constraints**
File: `backend/app/models/user.py:30-31`, `backend/app/schemas/user.py:28-29`
Fix: Both columns are bare `Float` with no database-level check constraints and no Pydantic validation bounds. A client could store `lat=999` or `lon=-9999`. Add `ge=-90, le=90` / `ge=-180, le=180` to `UserUpdate` and consider a PostgreSQL `CHECK` constraint for defence-in-depth.

**[P2] model: `Photo.captured_at` stored as timezone-naive datetime**
File: `backend/app/utils/exif.py:76`, `backend/app/models/photo.py:42`
Fix: `extract_captured_at` returns a `datetime.strptime(...)` result with no timezone info. The column is `DateTime(timezone=True)`, so PostgreSQL stores it as-is and assumes local time on retrieval. EXIF `DateTimeOriginal` has no timezone, but the comment says "UTC" — this assumption should be documented explicitly and ideally the value should be stored as `None`/raw and treated as approximate.

**[P2] schema: `RouteResponse` does not expose `is_draft`**
File: `backend/app/schemas/route.py:108`
Fix: `is_draft: bool = False` in `RouteResponse` is a hardcoded default — it is not read from the ORM model. The `Route` model does have `is_draft`, but `from_attributes=True` should populate it. The default `= False` will silently mask any truthy `is_draft` DB rows if `from_attributes` fails to bind the field. Verify the field resolves from the ORM and remove the default, or add an explicit `model_validate` test.

**[P2] model: no DB-level `CHECK` constraint on `title` length — only ORM/schema**
File: `backend/app/models/route.py:34`
Fix: `String(100)` defines the column storage but PostgreSQL's `varchar(n)` enforces length at the DB level, so this is actually fine for PostgreSQL. However the `Photo.s3_key_original` column uses `String(500)` — verify generated S3 keys never exceed this. The key format `photos/{uuid}/{uuid}/original.jpg` is ~80 chars so this is not currently an issue, but it is undocumented.

---

## 4. Backend — Architecture

**[P1] factory.py: uses deprecated `@app.on_event("startup"/"shutdown")`**
File: `backend/app/core/factory.py:42-54`
Fix: `@app.on_event` is deprecated in FastAPI 0.93+ in favour of `lifespan` context managers. This will produce deprecation warnings and will eventually stop working. Migrate to `@asynccontextmanager` lifespan.

**[P2] photo_service: `_validate_location_coords` imports from `schemas` layer**
File: `backend/app/services/photo_service.py:278`
Fix: `from app.schemas.photo import _validate_geojson_point` creates a dependency from the service layer down into the schema layer, which is an unusual direction (schemas should depend on services, not the reverse). The validation logic in `_validate_geojson_point` is pure and has no ORM dependency — it should live in `utils/` or be duplicated minimally in the service.

**[P2] discovery_service and photo_service: `_bbox_area_m2` is duplicated**
File: `backend/app/services/discovery_service.py:33-40`, `backend/app/services/photo_service.py:135-142`
Fix: Identical helper function duplicated across two service files. Extract to `utils/geometry.py` where the rest of the geospatial helpers live.

**[P2] slug.py: `ensure_unique_slug` (sync) is exported but never used**
File: `backend/app/utils/slug.py:35-53`
Fix: The synchronous `ensure_unique_slug` is dead code — all callers use `ensure_unique_slug_async`. Remove or document the sync variant is reserved for non-async contexts (e.g. migrations).

**[P2] auth_service.py: `logout()` is a no-op function**
File: `backend/app/services/auth_service.py:74-76`
Fix: `def logout() -> None: pass` is never called (the API layer handles cookie deletion directly). This empty function is misleading dead code and should be removed.

**[P2] config.py: logging side-effect in `__init__`**
File: `backend/app/core/config.py:61-64`
Fix: `Settings.__init__` calls `logging.getLogger("config").info(...)` before `setup_logging` has been called (logging is configured in `create_app`). This log line uses the default unconfigured logger, so it may not appear in production structured logs. Move initialisation logging into the factory after `setup_logging`.

---

## 5. Backend — Rate Limiting

**[P1] rate_limit: in-memory store does not survive worker restarts or multi-process deployments**
File: `backend/app/middleware/rate_limit.py:64-72`
Fix: `_store` is a module-level singleton that resets on every process restart. Under gunicorn with multiple workers each worker maintains an independent counter, so the effective per-user limit is `rate_limit_user_per_minute × num_workers`. This is noted in a comment (`# Module-level store (single process). For multi-process would use Redis.`) but is a real production correctness issue — the Redis path should be used in production and `redis_url` should be required (not optional) for non-development environments.

**[P2] rate_limit: route-creation limit is skipped for all `development` environments with `e2e_test_secret` set**
File: `backend/app/middleware/rate_limit.py:146-148`
Fix: The skip condition `if settings.environment != "development" or not settings.e2e_test_secret:` means that any development environment with `e2e_test_secret` configured has no route-creation rate limit for _all_ users, not just E2E test users. A targeted exemption using the `X-E2E-Secret` header check (already implemented for the global limit) would be safer.

**[P2] rate_limit: upload limit only applied on `POST /v1/photos` exact path**
File: `backend/app/middleware/rate_limit.py:136`
Fix: `path.rstrip("/") == "/v1/photos"` — this is correct as written, but note that the route prefix is `/v1/photos` not `/v1/photo` so a typo risk exists. Add a test or assertion that the constant matches the actual router prefix.

---

## 6. Frontend — API Error Handling

**[P1] client.ts: 401 retry logic has a race condition with multiple concurrent requests**
File: `frontend/src/api/client.ts:60-79`
Fix: When a refresh is in progress (`isRefreshing = true`), concurrent requests `await refreshPromise` but `refreshPromise` is only set if `!isRefreshing`. There is a window between `isRefreshing = true` and `refreshPromise = (async () => {...})()` where a second 401 could see `isRefreshing = true`, skip the `if (!isRefreshing)` block, then `await undefined` (since `refreshPromise` starts as `null`). Move the `isRefreshing = true` assignment inside the same synchronous block as `refreshPromise = ...`.

**[P1] Browse.tsx: `handleListPageChange` `.then()` has no `.catch()` — silent failure on error**
File: `frontend/src/pages/Browse.tsx:784-795`
Fix: The `.then(...)` / `.finally(...)` chain on `getBrowseRoutes(...)` has no `.catch()`. If the request fails with a non-200 status, the promise rejects silently — `loading` gets cleared but `routes` retains stale data and no error is shown to the user. Add a `.catch()` that clears `routes` and/or shows a toast.

**[P1] RouteDetail.tsx: `refetch()` has no error handling**
File: `frontend/src/pages/RouteDetail.tsx:70-73`
Fix: `getRouteBySlug(slug).then(setData)` — if this rejects (e.g. network error after photo location save) there is no `.catch()`, resulting in an unhandled promise rejection. Add error handling.

**[P2] Browse.tsx: error path in `fetchPhotosInBbox` parses error shape with unsafe `as` casts**
File: `frontend/src/pages/Browse.tsx:304-319`
Fix: The error message extraction uses multiple nested `as` casts without null-safety (`(err as {...}).response?.data?.detail?.message`). This pattern is repeated across CreateRoute, CreateRouteFromPhotos, and RouteDetail. Consider extracting a shared `extractApiErrorMessage(err: unknown): string` utility.

---

## 7. Frontend — Type Safety

**[P1] No runtime validation of API responses — all responses cast directly via TypeScript generics**
File: `frontend/src/api/client.ts`, `frontend/src/api/routes.ts`, `frontend/src/api/photos.ts`, `frontend/src/api/auth.ts`
Fix: All API responses use `apiClient.get<SomeType>(...)` which is purely a TypeScript compile-time cast — there is no runtime validation (e.g. Zod). If the backend adds or renames a field, the frontend will silently receive `undefined` for fields it assumed were present. For the most critical types (`User`, `Route`, `Photo`) consider adding Zod schemas or at minimum runtime assertions on key fields.

**[P2] Browse.tsx: `r.first_photo_id as string` non-null assertion**
File: `frontend/src/pages/Browse.tsx:210`
Fix: `const id = r.first_photo_id as string` — `first_photo_id` is typed `string | null | undefined` but is cast to `string`. The surrounding filter `routes.filter((r) => r.first_photo_id)` does ensure truthiness, but the `as string` cast is unnecessary and hides the intent. Use proper type narrowing.

**[P2] types/route.ts: `Route` type does not include `is_draft`**
File: `frontend/src/types/route.ts:33-47`
Fix: The backend `RouteResponse` schema includes `is_draft: bool`. The frontend `Route` type omits this field. Any frontend logic that needs to check draft status will silently treat all routes as non-draft.

**[P2] photo.ts: `Photo.location.coordinates` typed as `number[]` not `[number, number]`**
File: `frontend/src/types/photo.ts:7`
Fix: `location: { type: string; coordinates: number[] } | null` — in many places the code casts coordinates to `[number, number]` with `as`. Tightening the type to `[number, number]` would remove the need for casts and provide better compile-time safety.

**[P2] CreateRouteFromPhotos.tsx: unhandled promise rejection in thumbnail fallback chain**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx:126-138`
Fix: `.catch(() => fetchPhotoImageBlob(p.id, 'original').then(...))` — if the `.then(...)` inside the first `.catch()` rejects, there is a second `.catch()` to handle it, which is correct. However the intermediate `.then()` for the object URL creation does not have error handling if `URL.createObjectURL` itself throws (e.g. empty blob). Low probability but worth noting.

---

## 8. Frontend — Auth / Token Storage

**[P0] authStore: access token stored in Zustand in-memory store, but persisted on `window` via module scope**
File: `frontend/src/store/authStore.ts`
Fix: The access token is stored in Zustand state (in-memory) — this is correct and good. There is no `localStorage` or `sessionStorage` persistence for the token. This is the right approach. No action needed for the token itself.

**[P1] authStore: `clearUser()` only clears `user` and `accessToken` — other cached state is not cleared**
File: `frontend/src/store/authStore.ts:22`
Fix: `clearUser: () => set({ user: null, accessToken: null })` clears auth credentials but does not clear any route or photo data cached in component state. If a user logs out and another user logs in on the same browser session, the previous user's `routes`, `photos`, and map state can persist in component-level `useState` until the component unmounts. This is not a security leak (data is fetched with new auth) but could cause momentary display of the previous user's data. Consider adding a global cache invalidation mechanism or using a session key to key all state.

**[P1] useAuth.ts: `initPromise` is module-level — shared across all component instances and persists across React strict-mode double-invocations**
File: `frontend/src/hooks/useAuth.ts:6`
Fix: `let initPromise: Promise<void> | null = null` is a module-level singleton. In React Strict Mode (development), effects run twice. On the second run, `initPromise` is already set so the session check is skipped. More importantly, after logout + re-login in the same session, `initPromise` remains resolved and the session re-init on the next mount is skipped. Clear `initPromise` on `clearUser()` or move it inside the store.

**[P2] auth.ts: `REDIRECT_KEY` is imported but never used in the auth module itself**
File: `frontend/src/api/auth.ts:5`
Fix: `export const REDIRECT_KEY = 'photowalker_redirect'` is exported from `auth.ts` but the redirect logic that reads/writes `sessionStorage` using this key appears to live elsewhere. Verify this constant is actually used and the read/write is happening consistently on both sides of the OAuth redirect.

---

## 9. Frontend — State Management

**[P1] Browse.tsx: `thumbnailUrlsRef` and `browsePhotoThumbnailUrlsRef` are not revoked on new fetch — object URL memory leak**
File: `frontend/src/pages/Browse.tsx:229-234`, `267-273`
Fix: The cleanup functions in the two `useEffect` blocks revoke all URLs in the ref, but `thumbnailUrlsRef.current` is set to `{}` and then `URL.revokeObjectURL` is called on the _old_ values. This is correct in the cleanup path. However, when `routesWithPhoto` or `browsePhotos` changes and new URLs are added incrementally (via `.then` callbacks), old URLs for photos that are no longer in the new data set are not revoked until the effect cleanup runs. For large datasets this could accumulate a significant number of live blob URLs. Consider tracking which IDs were removed between renders and revoking immediately.

**[P2] Browse.tsx: `fetchList` inside `useCallback` depends on `tagsFilter` — will recreate callback on every keystroke**
File: `frontend/src/pages/Browse.tsx:276-293`
Fix: `fetchList` depends on `tagsFilter` via the `useCallback` dependency array. This means every time the user types a character in the tags input, `fetchList` is recreated, which in turn triggers the `useEffect` on line 368-373 because `fetchList` is a dependency. The debounce is not applied to the list fetch triggered by `useEffect` — only the map bbox fetch is debounced. This could cause excessive API requests while typing.

**[P2] RouteDetail.tsx: `refetch` does not reset error/loading state**
File: `frontend/src/pages/RouteDetail.tsx:70-73`
Fix: `refetch` is called after a successful location save. It calls `getRouteBySlug(slug).then(setData)` without setting `loading = true` or clearing `error`. The UI stays in "data shown" state, which is fine for a background refresh, but an error during refetch leaves `data` stale and `error` null with no visual indicator.

---

## 10. Frontend — Component Quality

**[P1] Browse.tsx: component is 958 lines — extreme size, mixing data fetching, map management, and rendering**
File: `frontend/src/pages/Browse.tsx`
Fix: `Browse` handles: API fetching (routes, bbox photos), map layer management (two separate layer sets), cluster marker DOM management, thumbnail blob loading (two separate sets), lightbox state, welcome modal state, list overlay state, keyboard event listeners, and view mode switching. This should be broken into:
- A `useBrowseRoutes` hook for route fetch + map layer logic
- A `useBrowsePhotos` hook for photo fetch + photo layer logic
- A `useClusterMarkers` hook for marker management
- `Browse` as a thin coordinator component

**[P1] ErrorBoundary: renders raw error stack trace to end users in production**
File: `frontend/src/components/common/ErrorBoundary.tsx:44-49`
Fix: The `<details>` block renders `this.state.error.stack` which includes file paths, line numbers, and minified source paths. In production this leaks internal build structure. Guard the stack trace with a `process.env.NODE_ENV === 'development'` check, or omit it entirely from production builds.

**[P2] CreateRouteFromPhotos.tsx: `handleFiles` uploads photos sequentially in a for loop**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx:173-185`
Fix: Photos are uploaded one at a time with `await uploadPhoto(...)` inside a for loop. For a user adding 10 photos this is needlessly slow. `Promise.allSettled` with a concurrency limit (e.g. 3 simultaneous) would give significantly better UX.

**[P2] Settings.tsx: placeholder component with no content**
File: `frontend/src/pages/Settings.tsx`
Fix: The page is a stub ("Settings page coming soon."). It is linked from the account dropdown (PRD v6 Step 1.3) and reachable by users. Either add meaningful content or redirect to a real destination rather than presenting a blank settings page.

**[P2] useRoutes.ts and useMap.ts: empty hook stubs**
File: `frontend/src/hooks/useRoutes.ts`, `frontend/src/hooks/useMap.ts`
Fix: Both hooks return `{}` with no implementation. Either implement them or remove them — empty hooks that are exported create false confidence that there is shared logic being reused when there is none.

---

## 11. Frontend — Accessibility

**[P1] Browse.tsx: cluster stack markers rendered with `aria-hidden="true"` but are interactive (clickable)**
File: `frontend/src/pages/Browse.tsx:124`
Fix: `container.setAttribute('aria-hidden', 'true')` is set on cluster markers that have click handlers. This means keyboard users and screen readers cannot interact with clusters at all — they are fully hidden from assistive technology. The cluster should instead have an appropriate `role="button"`, `aria-label` describing its content (e.g. "3 routes in this area"), and be keyboard-focusable.

**[P1] CreateRouteFromPhotos.tsx: drag-and-drop reorder is the only mechanism — no keyboard alternative**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx:554-558`
Fix: Photo reorder is implemented with HTML5 drag events (`draggable`, `onDragStart`, `onDragOver`, `onDragEnd`) with no keyboard equivalent (no up/down arrow key handlers). Users who cannot use a mouse cannot reorder photos, which is a WCAG 2.1 SC 2.1.1 failure.

**[P2] Browse.tsx: map `<div>` used as a focus return target with `tabIndex={-1}` but is 1x1px invisible**
File: `frontend/src/pages/Browse.tsx:839-844`
Fix: `mapFocusRef` targets a 1x1 pixel `<div>` with `aria-label="Map"`. While `tabIndex={-1}` prevents it from appearing in tab order, programmatic focus to this element provides a poor screen reader experience. Use a more meaningful landmark element or focus the map container itself.

**[P2] RouteDetail.tsx: `<div onClick>` used as modal backdrop dismiss — not keyboard accessible**
File: `frontend/src/pages/RouteDetail.tsx:246`, `433`
Fix: `onClick={(e) => e.target === e.currentTarget && setEditLocationError(null)}` on the modal backdrop `<div>` does not have a keyboard equivalent (`onKeyDown` for Escape is handled separately at the document level, which is fine). However the click-backdrop to dismiss only clears `editLocationError`, not `editingPhotoId` — the modal stays open. This appears to be a bug: the backdrop click should close the modal (`setEditingPhotoId(null)`) not merely clear the error.

**[P2] Browse.tsx (non-shell mode): Map/List toggle buttons have no `aria-pressed` or `aria-selected` state**
File: `frontend/src/pages/Browse.tsx:891-916`
Fix: The Map/List toggle buttons use `fontWeight` for visual active state but have no ARIA state attribute to communicate the selected mode to screen readers. Add `aria-pressed={viewMode === 'map'}` / `aria-pressed={viewMode === 'list'}` or wrap in a `role="tablist"` pattern.

**[P2] Browse.tsx: photo pin clicks open a lightbox with no `aria-label` on the triggering map layer**
File: `frontend/src/pages/Browse.tsx:579-599`
Fix: The `BROWSE_PHOTOS_LAYER_ID` MapLibre symbol layer triggers a lightbox on click but map symbol layers have no inherent ARIA semantics. Users navigating via keyboard or screen reader cannot discover or activate photo pins. This is a systemic issue with map-based interactions and should be tracked as a known limitation with a non-map fallback (e.g. accessible list of nearby photos).
