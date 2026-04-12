# PRD Review Pass 1 — 2026-03-06

Codebase review of Photowalker against `design/PRD.md`. Pure analysis; no source files modified.

---

## Summary Table

| Req ID  | Description                                | Backend  | Frontend | Status |
|---------|--------------------------------------------|----------|----------|--------|
| FR1     | Auth — Google OAuth, JWT, refresh, sign out, /auth/me | Partial  | N/A      | ⚠      |
| FR2     | Route Creation — photo-first + draw-first  | ✓        | ✓        | ✓      |
| FR3     | Photo Upload — JPEG, 10MB, EXIF GPS, S3, async thumbnail | ✓    | ✓        | ✓      |
| FR4     | Route Viewing — slug, polyline+pins, 404/403 | ✓      | ✓        | ✓      |
| FR5     | Route Browsing — bbox, tag/author, pagination, sort | ✓  | ✓        | ✓      |
| FR-R1   | Photo-first creation — EXIF auto-plot, place-on-map, drag reorder | ✓ | ✓ | ✓ |
| FR-R2   | Route-photo geometry consistency           | ✓        | ✓        | ✓      |
| FR-R3   | Nullable location, PATCH /photos/{id}, recompute | ✓   | ✓        | ✓      |
| FR-R4/R8 | Thumbnail pins (~40-48px), fallback dot, clustering | ✓  | ✓        | ✓      |
| FR-R5/R6 | Bulk reorder + add/remove, publish guard  | ✗        | ✗        | ✗      |
| FR-R7   | GPX export                                 | ✗        | ✗        | ✗      |
| FR-R9   | Undo/Redo (Ctrl+Z / Ctrl+Shift+Z, last 20) | N/A     | ✗        | ✗      |
| FR-R10  | Route Drafts — POST/GET/PATCH/DELETE /drafts | ✗      | ✗        | ✗      |
| FR-U1   | / → /browse; welcome modal (sessionStorage) | N/A    | ✓        | ✓      |
| FR-U2   | Browse: photo pins only, pin click → lightbox | N/A   | ✓        | ✓      |
| FR-U3   | Explore panel — All/My filter, Create button, hover highlights | N/A | ✓ | ✓ |
| FR-U4   | BottomDrawer peek+expand for route view and create | N/A | ✓  | ✓      |
| FR-U5   | Account icon: Sign in / Settings / Sign out only | N/A  | ✓        | ✓      |
| FR-U6   | No /routes/me page; My routes as panel filter only | N/A | ✓       | ✓      |
| FR-U7   | Touch targets ≥44px, rem/% sizing         | N/A      | ✓        | ✓      |
| NFR3    | Rate limits — 100 anon, 500 auth, 10 uploads/min | ✓   | N/A      | ✓      |
| NFR4    | JWT 15min, refresh 7d HTTP-only, CORS frontend only | Partial | N/A | ⚠   |
| NFR5    | ≥80% unit test coverage                   | Unknown  | Unknown  | ⚠      |

---

## Findings

### FR1 — Authentication

**[P1] auth: Sign out does not invalidate the refresh token server-side**
File: `backend/app/api/v1/auth.py:163-171`
Fix: `POST /auth/logout` only clears the HTTP-only cookie client-side. There is no refresh token blacklist or revocation mechanism. A stolen refresh token remains valid for up to 7 days after sign-out. Implement server-side token revocation (e.g. a token revocation table or Redis blocklist).

**[P2] auth: /routes/me backend endpoint exists but is not in the PRD**
File: `backend/app/api/v1/routes.py:76-85`
Fix: The recent commit "feat(backend): add my photos endpoint" added `GET /v1/photos/my`. Additionally `GET /v1/routes/me` already exists in `routes.py`. Neither endpoint is listed in the PRD API table. `GET /v1/photos/my` is the new endpoint from the recent commit — it is not required by any PRD requirement and adds undocumented surface area. Consider removing or documenting it.

---

### FR2 — Route Creation

Status: ✓ Both `POST /v1/routes/from-photos` (FR-R1) and `POST /v1/routes` (draw-first) are implemented and registered. Frontend `CreateRouteFromPhotos` page covers the primary flow.

---

### FR3 — Photo Upload

Status: ✓ JPEG-only enforced in `handleFiles` (frontend) and `upload_photo` service. Max 10MB enforced. `photos.location` is nullable (model confirmed). S3 storage in place. Thumbnail generated asynchronously (`s3_key_thumbnail` nullable on model).

---

### FR4 — Route Viewing

Status: ✓ `GET /v1/routes/{slug}` implemented with 404 on missing slug and 403 for private routes when not owner. `RouteDetail` frontend page exists.

---

### FR5 — Route Browsing

Status: ✓ `GET /v1/routes` in `discovery.py` supports bbox, tags, author_id, page, per_page, sort (created_at | distance). Frontend `ExploreRoutesPanel` and `Browse` page use these.

---

### FR-R1 — Photo-first Route Creation

Status: ✓ EXIF GPS auto-plotted on upload. `MapPicker` used for manual placement. Drag-and-drop reorder implemented in `CreateRouteFromPhotos`. `POST /v1/routes/from-photos` calls `route_service.create_route_from_photos`.

---

### FR-R2 — Route-Photo Geometry Consistency

Status: ✓ Route geometry is derived from ordered photo locations at creation time via `create_route_from_photos`. `PATCH /v1/photos/{id}` triggers geometry recompute for associated routes (confirmed by integration test `test_api_photos.py:246`).

---

### FR-R3 — Nullable Location / PATCH /photos/{id}

Status: ✓ `photos.location` is `nullable=True` (model confirmed). `PATCH /v1/photos/{photo_id}` accepts `PhotoUpdate` with `location` field. Frontend "Set location" button calls `updatePhoto` with a GeoJSON Point.

---

### FR-R4 / FR-R8 — Thumbnail Pins and Clustering

Status: ✓
- `pinImageUtils.ts` provides `imageToPinImageData` (thumbnail pin, circular, ~44px base via `PIN_ICON_SIZE = 44`) and `createDefaultPinImageData` (fallback solid-blue dot).
- `clusterConfig.ts` configures clustering: `CLUSTER_MAX_ZOOM = 12`, `CLUSTER_RADIUS = 80`, `CLUSTER_MIN_POINTS = 3`.
- Cluster expand on click implemented in `Browse.tsx` via `getClusterExpansionZoom`.
- Browse map pins sized dynamically via `BROWSE_PIN_ZOOM_SIZE` zoom interpolation.

**[P2] fr-r4: Cluster count badge not rendered for photo pins on browse map**
File: `frontend/src/pages/Browse.tsx`
Fix: In `browse-photos` mode (shell map), the photo layer uses a MapLibre symbol layer without clustering enabled. The route cluster stack markers show stacked thumbnails but no numeric count badge. The PRD specifies a "count badge" on clusters. This is partially implemented for route clusters (stacked thumbnails) but missing the explicit count overlay. Consider adding a count label element to `createRouteClusterStackElement`.

---

### FR-R5 / FR-R6 — Bulk Reorder and Add/Remove Photos

**[P0] fr-r5: PATCH /v1/routes/{route_id}/photos/order endpoint missing**
File: `backend/app/api/v1/routes.py`
Fix: The PRD requires `PATCH /routes/{route_id}/photos/order` for bulk reorder of photos in an existing route. This endpoint does not exist in `routes.py` or any other registered router. Without it, photo order in an existing (already-created) route cannot be persisted.

**[P0] fr-r6: DELETE /v1/routes/{route_id}/photos/{photo_id} endpoint missing**
File: `backend/app/api/v1/routes.py`
Fix: The PRD requires `DELETE /routes/{route_id}/photos/{photo_id}` to remove a photo from a route without deleting the photo globally. This endpoint does not exist. Only `DELETE /v1/photos/{photo_id}` exists, which deletes the photo entirely.

**[P1] fr-r5/r6: No frontend UI for reorder/add/remove on existing routes**
File: `frontend/src/` (no matching component found)
Fix: There is no component for editing an existing route's photo list (reorder, add, remove). The create flow has drag-and-drop but it applies only during initial creation, not to saved routes.

**[P1] fr-r6: Publish guard (≥2 photos) only enforced at creation, not on removal**
File: `backend/app/api/v1/routes.py`
Fix: Without the delete-from-route endpoint, the publish guard cannot be enforced when removing a photo from a published route. When the endpoint is added, it must check that the route does not drop below 2 photos if published.

---

### FR-R7 — GPX Export

**[P0] fr-r7: GET /v1/routes/{slug}/gpx endpoint missing**
File: `backend/app/api/v1/routes.py`
Fix: No GPX export endpoint exists anywhere in the backend. The PRD requires `GET /v1/routes/{slug}/gpx` returning `application/gpx+xml` with a track and photo waypoints. No frontend "Export GPX" action exists either. Implement the endpoint and add an export button to the route detail view.

---

### FR-R9 — Undo/Redo

**[P1] fr-r9: Undo/Redo not implemented in create flow**
File: `frontend/src/pages/CreateRouteFromPhotos.tsx`
Fix: No undo/redo stack, no Ctrl+Z / Ctrl+Shift+Z keyboard handler, and no history management exists in `CreateRouteFromPhotos`. The PRD requires last ~20 actions to be undoable. Implement a `useUndoRedo` hook or similar around the `photos` state array.

---

### FR-R10 — Route Drafts

**[P0] fr-r10: Drafts endpoints missing (POST/GET/PATCH/DELETE /v1/drafts)**
File: `backend/app/core/factory.py`
Fix: No drafts router is registered in `factory.py`. The PRD requires four dedicated draft endpoints. The `is_draft` column exists on the `routes` model (migration `004_routes_drafts.py` confirmed) and is included in `RouteResponse`, but no API surface exposes draft CRUD. There is no frontend draft save/list/publish flow either. Implement a `drafts.py` router with the four required endpoints and register it in `factory.py`.

---

### FR-U1 — Landing Redirect and Welcome Modal

Status: ✓
- `App.tsx:139` has `<Route path="/" element={<Navigate to="/browse" replace />} />`.
- `welcomeStorage.ts` uses `sessionStorage` (key `photowalker_welcome_dismissed`).
- `WelcomeModal` is dismissible ("Browse the map", "Maybe later", Escape key).
- `Browse.tsx` renders `<WelcomeModal>` when `!isAuthenticated && !welcomeDismissed`.

---

### FR-U2 — Browse: Photo Pins Only, Lightbox

Status: ✓ In `browse-photos` shell map mode, `Browse.tsx` fetches from `GET /v1/photos?bbox=` and renders photo pins. Pin click sets `selectedPhotoForLightbox` and opens `PhotoGallery` lightbox with photo, user name, and route references. Routes are not shown by default in shell map mode.

---

### FR-U3 — Explore Panel

Status: ✓ `ExploreRoutesPanel` is a left collapsible panel with All/My routes filter, paginated route cards, Create route button, hover/select highlight via `onHighlightRoute` callback, and bbox-aware route fetching.

---

### FR-U4 — BottomDrawer

Status: ✓ `BottomDrawer` component has peek state (strip with title) and expanded state (scrollable content, 60% height / 80vh max). Used by `CreateRouteFromPhotos` and `RouteDetail`.

---

### FR-U5 — Account Icon

Status: ✓ `AccountIcon.tsx` renders a circular button top-right (fixed, z-index 1000). Dropdown contains only: Sign in (when unauthenticated), Settings (always), Sign out (when authenticated). No "My routes" or "Create route" items present.

---

### FR-U6 — No /routes/me Page

Status: ✓ `App.tsx:143` redirects `/routes/me` to `/browse`. My routes appears only as a filter inside `ExploreRoutesPanel`.

**[P2] fr-u6: Backend GET /v1/routes/me exists but is undocumented in PRD**
File: `backend/app/api/v1/routes.py:76-85`
Fix: The endpoint works correctly (returns authenticated user's routes) and could be a useful internal utility, but it is not in the PRD API table and adds unreviewed surface area. Document or remove.

---

### FR-U7 — Touch Targets and Sizing

Status: ✓
- `PIN_ICON_SIZE = 44` (pinImageUtils.ts) — meets the ≥44px WCAG target explicitly noted in the comment.
- `AccountIcon` trigger is `width: 40, height: 40` — technically 4px below the 44px minimum.

**[P2] fr-u7: AccountIcon touch target is 40px, below the 44px minimum**
File: `frontend/src/components/common/AccountIcon.tsx:42-56`
Fix: `triggerStyle` sets `width: 40, height: 40`. The PRD requires ≥44px touch targets. Increase to 44px or add padding to meet the minimum.

---

### NFR3 — Rate Limits

Status: ✓ `RateLimitMiddleware` implements: 100 req/min for anonymous (IP-keyed), 500 req/min for authenticated (user-keyed), 10 uploads/min (POST /v1/photos), and 5 routes/hour as an additional guard. All match or exceed PRD requirements. Health endpoints are excluded from rate limiting.

---

### NFR4 — JWT and Security

Status: Partial

- JWT access token: 15 min (`jwt_access_token_expire_minutes = 15`) ✓
- Refresh token: 7 days HTTP-only cookie ✓
- CORS: `allow_origins=[settings.frontend_url]` — single origin, credentials allowed ✓

**[P1] nfr4: Refresh token not invalidated on sign-out (see FR1 finding above)**
The logout endpoint only clears the client-side cookie. The refresh token JWT itself remains cryptographically valid until its 7-day expiry. Without server-side revocation, sign-out does not truly invalidate the session.

---

### NFR5 — Test Coverage

**[P2] nfr5: Test coverage not verified at ≥80%**
File: `backend/tests/`, `frontend/src/**/*.test.*`
Fix: Backend has unit and integration tests across most service and API modules. Frontend has tests for key components (AccountIcon, BottomDrawer, ExploreRoutesPanel, Browse, CreateRouteFromPhotos, etc.). However, no coverage report was checked and no CI badge or threshold config was found. Run `pytest --cov` and the frontend coverage reporter to confirm the ≥80% threshold is met, and add a CI coverage gate to prevent regression.

**[P2] nfr5: Backend unit test placeholder present**
File: `backend/tests/unit/test_placeholder.py`
Fix: A placeholder test file exists. Confirm it is empty/trivial and does not inflate coverage numbers.

---

### Additional Finding — Undocumented Endpoint

**[P2] api: GET /v1/photos/my not in PRD**
File: `backend/app/api/v1/photos.py:119-177`
Fix: Added in the recent commit "feat(backend): add my photos endpoint", this endpoint (`GET /v1/photos/my`) returns the authenticated user's photos in a bbox. It is not listed in the PRD API table. If it is intended for a future feature (e.g. a "My photos" map view), add it to the PRD or mark it as experimental. Otherwise remove it to keep the API surface consistent with the spec.

---

### MapShell Mode Gap

**[P2] mapshell: explore-route-highlight mode not in MapShellMode type**
File: `frontend/src/components/map/MapShell.tsx:13`
Fix: The PRD defines four MapShell modes: `browse-photos`, `explore-route-highlight`, `detail`, `create`. The `MapShellMode` type in `MapShell.tsx` contains `browse`, `browse-photos`, `detail`, `create`, `home` — it is missing `explore-route-highlight` and includes `browse` and `home` which are not in the PRD. The mode is not currently used inside `MapShell` (passed as a prop but the component ignores it), but when mode-based layer switching is implemented this discrepancy will cause issues.

---

## Summary of Critical Gaps

| Priority | Count | Items |
|----------|-------|-------|
| P0 | 4 | GPX export endpoint, bulk reorder endpoint, remove-photo-from-route endpoint, drafts endpoints |
| P1 | 4 | Undo/redo in create flow, sign-out doesn't invalidate refresh token, no frontend edit-route UI, publish guard not enforced on removal |
| P2 | 7 | Cluster count badge, AccountIcon 40px touch target, /routes/me undocumented, /photos/my undocumented, MapShell mode type mismatch, test coverage not verified, placeholder test file |
