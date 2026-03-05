# Photowalker Implementation Roadmap v3

**Version:** 1.0  
**Date:** 2026-02-06  
**Design Reference:** [PRD v3](./PRD_v3.md)  
**Prerequisite:** [IMPLEMENTATION_ROADMAP](./IMPLEMENTATION_ROADMAP.md) (v2 MVP complete)

---

## Overview

This document defines a phased implementation plan for PRD v3 UX enhancements. It assumes the v2 MVP is implemented and functional. Each phase consists of discrete, committable steps. Every step includes:

- **Agent Instructions:** Clear requirements for the coding agent
- **Design Constraints:** Explicit references to PRD v3; no deviation without permission
- **Unit Tests:** Required test coverage
- **User Acceptance Tests (UAT):** Tests against user stories and acceptance criteria
- **Definition of Done:** Criteria that must be met before marking complete

---

## Design Authority

**Primary Reference:** [design/PRD_v3.md](./PRD_v3.md)

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
| 1 | Foundation | 4 | 4 |
| 2 | Photo-First Creation | 5 | 5 |
| 3 | Map UX | 4 | 4 |
| 4 | Route Management | 3 | 3 |
| 5 | Export & Drafts | 4 | 4 |
| **Total** | | **20** | **20** |

---

## Phase 1: Foundation

**Goal:** DB migrations for v3 schema, PATCH photo location, upload photos without GPS.

**Design Reference:** [PRD v3 - FR-R3](./PRD_v3.md#fr-r3-photos-without-location--location-editing), [Database Changes](./PRD_v3.md#database-changes)

---

### Step 1.1: Database Migrations

**Branch:** `feat/v3-foundation`  
**Commit Message:** `feat(backend): add v3 migrations - photos.location nullable, routes.is_draft`

#### Agent Instructions

1. Create Alembic migration `003_photos_location_nullable.py`:
   - `ALTER TABLE photos ALTER COLUMN location DROP NOT NULL`
   - GIST index on `location` remains; nulls are excluded from spatial queries
2. Create Alembic migration `004_routes_drafts.py`:
   - Add `is_draft BOOLEAN NOT NULL DEFAULT false` to `routes`
   - Add index `idx_routes_is_draft_user` on `(is_draft, user_id)` partial `WHERE is_draft = true`
3. Update `app/models/photo.py`: `location` column nullable
4. Update `app/models/route.py`: add `is_draft` column
5. Run `alembic upgrade head` and verify

#### Design Constraints

- [PRD v3 - Database Changes](./PRD_v3.md#database-changes)
- Do not break existing routes or photos; migration must be backward compatible

#### Unit Tests

- `tests/integration/test_migrations.py`: `alembic upgrade head` succeeds; verify columns exist
- `tests/unit/test_models.py`: Photo with location=NULL is valid; Route with is_draft=True is valid

#### UAT

- N/A

#### Definition of Done

- [ ] Migrations run successfully
- [ ] Photo model accepts null location
- [ ] Route model has is_draft field
- [ ] Existing data unaffected

---

### Step 1.2: Photo Service - Upload Without GPS, Update Location

**Branch:** `feat/v3-foundation`  
**Commit Message:** `feat(backend): allow photo upload without GPS, add location to PATCH`

#### Agent Instructions

1. Modify `app/services/photo_service.py`:
   - `upload_photo`: Do not reject when EXIF GPS missing; store with `location=NULL`
   - Allow `route_ids=[]` (photos uploaded for new route creation)
   - `update_photo`: Accept optional `location` parameter; validate coordinates; update `photos.location`
2. Add `location` to `app/schemas/photo.py` PhotoUpdate: `location: Optional[dict]` with GeoJSON Point validation
3. Validate coordinates: lon in [-180, 180], lat in [-90, 90]

#### Design Constraints

- [PRD v3 - FR-R3](./PRD_v3.md#fr-r3-photos-without-location--location-editing)
- [PRD v3 - API - PATCH photos](./PRD_v3.md#modified-endpoints)

#### Unit Tests

- `tests/unit/test_photo_service.py`:
  - upload_photo with no GPS creates photo with location=NULL
  - upload_photo with route_ids=[] creates photo without route_photos
  - update_photo with location updates photo.location
  - update_photo with invalid coordinates raises ValueError

#### UAT

- N/A (API layer; UAT in Step 1.4)

#### Definition of Done

- [ ] Upload accepts photos without GPS
- [ ] PATCH accepts location
- [ ] Unit tests pass

---

### Step 1.3: Photo API - Location in PATCH, Upload Without GPS

**Branch:** `feat/v3-foundation`  
**Commit Message:** `feat(backend): add location to PATCH /v1/photos, allow upload without GPS`

#### Agent Instructions

1. Update `app/api/v1/photos.py`:
   - PATCH: pass `body.location` to `photo_service.update_photo`
   - POST: remove rejection when GPS missing; return 201 with photo (location may be null)
2. Update `app/schemas/photo.py` PhotoUpdate: add `location: Optional[dict]` (GeoJSON Point)
3. Ensure PhotoResponse serializes `location` as null when absent

#### Design Constraints

- [PRD v3 - API Changes](./PRD_v3.md#modified-endpoints)

#### Unit Tests

- `tests/integration/test_api_photos.py`:
  - POST /v1/photos with JPEG without GPS returns 201 (was 400)
  - PATCH /v1/photos/{id} with location updates and returns photo
  - PATCH /v1/photos/{id} with invalid location returns 400

#### UAT

- **UAT-FR-R3.1:** Upload photo without EXIF GPS → 201, photo created with location=null
- **UAT-FR-R3.2:** PATCH photo with location → 200, photo.location updated

#### Definition of Done

- [ ] Upload without GPS returns 201
- [ ] PATCH location works
- [ ] Integration tests pass

---

### Step 1.4: Photo Frontend - Place on Map, Edit Location

**Branch:** `feat/v3-foundation`  
**Commit Message:** `feat(frontend): add place-on-map and edit-location for photos`

#### Agent Instructions

1. Update `PhotoUploadForm`: when upload succeeds but location is null, show "Place on map" step
2. Add map picker component: user clicks on map to set coordinates; call PATCH /v1/photos/{id} with location
3. On route detail: add "Edit location" to photo context menu or edit modal; open map picker; PATCH on save
4. Handle upload of photos without GPS: after upload, for each photo with null location, show place-on-map flow before allowing route creation

#### Design Constraints

- [PRD v3 - FR-R3](./PRD_v3.md#fr-r3-photos-without-location--location-editing)

#### Unit Tests

- Map picker component: calls onSelect with [lon, lat] when map clicked
- PhotoUploadForm: when photo has no location, shows place-on-map step

#### UAT

- **UAT-FR-R3 (Full):** As a user, I can upload photos without GPS and place them on the map
  - Upload JPEG without EXIF → "Place on map" step shown
  - Click on map → location saved via PATCH
  - Edit location of existing photo → map picker opens, PATCH on save

#### Definition of Done

- [ ] Place-on-map flow works for uploads without GPS
- [ ] Edit location works on route detail
- [ ] UAT-FR-R3 passes

---

## Phase 2: Photo-First Creation

**Goal:** POST /routes/from-photos, new Create Route flow (upload → place → connect), route geometry from photos.

**Design Reference:** [PRD v3 - FR-R1](./PRD_v3.md#fr-r1-photo-first-route-creation), [FR-R2](./PRD_v3.md#fr-r2-strict-route-photo-consistency)

---

### Step 2.1: Route Service - Create from Photos

**Branch:** `feat/v3-photo-first`  
**Commit Message:** `feat(backend): add create_route_from_photos service`

#### Agent Instructions

1. Implement `app/services/route_service.py`:
   - `create_route_from_photos(user_id, data: RouteFromPhotosCreate)`:
     - Validate: all photo_ids have location set; ≥2 photos; user owns all photos
     - Fetch photos in order; build LineString from photo locations (order = photo_ids order)
     - Compute distance with existing geometry utils
     - Generate slug, create route, create route_photos with display_order
     - Return route
2. Add `app/schemas/route.py` RouteFromPhotosCreate: title, description, tags, is_public, photo_ids, slug (optional)
3. Enforce: route_geometry vertices = photo locations in order

#### Design Constraints

- [PRD v3 - FR-R1](./PRD_v3.md#fr-r1-photo-first-route-creation)
- [PRD v3 - FR-R2](./PRD_v3.md#fr-r2-strict-route-photo-consistency)

#### Unit Tests

- `tests/unit/test_route_service.py`:
  - create_route_from_photos builds LineString from photo locations in order
  - create_route_from_photos rejects when photo has null location
  - create_route_from_photos rejects when <2 photos
  - create_route_from_photos rejects when user does not own photo

#### UAT

- N/A

#### Definition of Done

- [ ] create_route_from_photos implemented
- [ ] Route geometry derived from photos
- [ ] Unit tests pass

---

### Step 2.2: Route API - POST /routes/from-photos

**Branch:** `feat/v3-photo-first`  
**Commit Message:** `feat(backend): add POST /v1/routes/from-photos endpoint`

#### Agent Instructions

1. Implement `POST /v1/routes/from-photos` in `app/api/v1/routes.py`:
   - Auth required
   - Body: RouteFromPhotosCreate
   - Call `create_route_from_photos`
   - Return 201 with route
2. Validate: photo_ids non-empty, all UUIDs; title 1-100 chars; tags max 5
3. Return 400 with clear message when validation fails (e.g. "Photo X has no location")

#### Design Constraints

- [PRD v3 - API - Route from Photos](./PRD_v3.md#route-from-photos)

#### Unit Tests

- `tests/integration/test_api_routes.py`:
  - POST /v1/routes/from-photos with valid data returns 201
  - POST /v1/routes/from-photos with photo missing location returns 400
  - POST /v1/routes/from-photos with <2 photos returns 400

#### UAT

- **UAT-FR-R1.1:** POST /v1/routes/from-photos with 2+ photos with locations → 201, route created with correct geometry

#### Definition of Done

- [ ] Endpoint implemented
- [ ] Integration tests pass

---

### Step 2.3: Route Geometry Recomputation Utility

**Branch:** `feat/v3-photo-first`  
**Commit Message:** `feat(backend): add recompute_route_geometry_from_photos utility`

#### Agent Instructions

1. Implement `app/services/route_service.py`:
   - `recompute_route_geometry_from_photos(route_id)`:
     - Fetch route_photos ordered by display_order; fetch photo locations
     - Build LineString from locations; update route.route_geometry and route.distance_meters
     - Call after: add photo, remove photo, reorder photos
2. Ensure route has ≥2 photos with location before recomputing; if <2, handle (e.g. set geometry to empty or skip)

#### Design Constraints

- [PRD v3 - FR-R2](./PRD_v3.md#fr-r2-strict-route-photo-consistency)

#### Unit Tests

- recompute_route_geometry_from_photos updates route geometry from photo order
- recompute with 1 photo: handle gracefully (empty or single-point LineString per product decision)

#### UAT

- N/A

#### Definition of Done

- [ ] Recomputation utility works
- [ ] Unit tests pass

---

### Step 2.4: Create Route Page - Photo-First Flow

**Branch:** `feat/v3-photo-first`  
**Commit Message:** `feat(frontend): add photo-first create route page`

#### Agent Instructions

1. Create new entry point: "Create route from photos" (or replace/primary Create Route)
2. Flow: (a) Upload photos (batch); (b) For photos without GPS, place on map; (c) Plot points on map; (d) User connects points (draw segments, reorder); (e) User enters title, description, tags; (f) Submit to POST /v1/routes/from-photos
3. Map: show photo points; use Mapbox GL Draw or custom UX to connect points (draw line through points in order)
4. Reorder: drag-and-drop list of photos; order determines LineString vertices
5. Submit: validate ≥2 photos with location; call API; redirect to route page on success

#### Design Constraints

- [PRD v3 - FR-R1](./PRD_v3.md#fr-r1-photo-first-route-creation)
- Points ordered by captured_at or upload order; user can reorder

#### Unit Tests

- CreateRouteFromPhotos: submit sends photo_ids in correct order
- Validation: reject submit when <2 photos or any photo has no location

#### UAT

- **UAT-FR-R1 (Full):** As a user, I can create a route by uploading photos and connecting them on a map
  - Upload 3 photos with GPS → points appear on map
  - Reorder photos → route preview updates
  - Enter title, submit → route created → redirect to route page
  - Route geometry matches photo order

#### Definition of Done

- [ ] Photo-first flow works end-to-end
- [ ] User can upload, place, connect, and submit
- [ ] UAT-FR-R1 passes

---

### Step 2.5: Undo/Redo for Route Drawing

**Branch:** `feat/v3-photo-first`  
**Commit Message:** `feat(frontend): add undo/redo for route drawing`

#### Agent Instructions

1. Implement undo/redo for draw actions when connecting photos:
   - Track history: add point, remove point, move point, reorder
   - Undo: revert last action; Redo: reapply
   - Limit history to last 20 actions (session-only)
2. Keyboard shortcuts: Ctrl+Z / Cmd+Z (undo), Ctrl+Shift+Z / Cmd+Shift+Z (redo)
3. UI: Undo/Redo buttons in route creation toolbar; disable when nothing to undo/redo

#### Design Constraints

- [PRD v3 - FR-R9](./PRD_v3.md#fr-r9-undoredo-for-route-drawing)

#### Unit Tests

- Undo stack: push action, undo reverts, redo reapplies
- Undo on empty: no-op; Redo when nothing to redo: no-op

#### UAT

- **UAT-FR-R9:** As a user, I can undo and redo drawing actions
  - Add point, Undo → point removed
  - Redo → point re-added
  - Keyboard shortcuts work

#### Definition of Done

- [ ] Undo/redo works for draw actions
- [ ] Keyboard shortcuts work
- [ ] UAT-FR-R9 passes

---

## Phase 3: Map UX

**Goal:** Thumbnail pins on map, photo clustering.

**Design Reference:** [PRD v3 - FR-R4](./PRD_v3.md#fr-r4-thumbnail-pins-on-map), [FR-R8](./PRD_v3.md#fr-r8-photo-clustering-on-map)

---

### Step 3.1: PhotoMarker - Thumbnail Support

**Branch:** `feat/v3-map-ux`  
**Commit Message:** `feat(frontend): render photo thumbnails as map pins`

#### Agent Instructions

1. Update `frontend/src/components/map/PhotoMarker.tsx`:
   - Accept `thumbnailUrl?: string`
   - If thumbnailUrl present: render `<img src={thumbnailUrl} />` in marker (size ~40-48px)
   - Else: fallback to blue dot (current behavior)
2. Lazy-load: show blue dot placeholder until image loads; on error, keep blue dot
3. Update RouteView: pass thumbnail URL per photo (from getPhotoImageUrl(photoId, 'thumbnail'))

#### Design Constraints

- [PRD v3 - FR-R4](./PRD_v3.md#fr-r4-thumbnail-pins-on-map)

#### Unit Tests

- PhotoMarker with thumbnailUrl renders img
- PhotoMarker without thumbnailUrl renders blue dot

#### UAT

- **UAT-FR-R4.1:** Map pins show photo thumbnails when available
- **UAT-FR-R4.2:** Map pins fallback to blue dot when thumbnail loading or missing

#### Definition of Done

- [ ] Thumbnail pins render
- [ ] Fallback works
- [ ] UAT-FR-R4.1, FR-R4.2 pass

---

### Step 3.2: Photo Clustering

**Branch:** `feat/v3-map-ux`  
**Commit Message:** `feat(frontend): add photo clustering on map at low zoom`

#### Agent Instructions

1. Integrate clustering library (e.g. supercluster, mapbox-gl native clustering, or MapLibre equivalent)
2. At low zoom: cluster nearby photo pins; show count badge on cluster icon
3. On zoom in or click cluster: expand to individual pins (or thumbnails)
4. Styling consistent with app theme

#### Design Constraints

- [PRD v3 - FR-R8](./PRD_v3.md#fr-r8-photo-clustering-on-map)

#### Unit Tests

- Clustering: multiple photos at same location show as cluster with count
- Zoom/click expands cluster to pins

#### UAT

- **UAT-FR-R8:** As a user, I see grouped pins when many photos are close at low zoom
  - Zoom out with many photos → clusters with count
  - Zoom in / click cluster → individual pins visible

#### Definition of Done

- [ ] Clustering works
- [ ] UAT-FR-R8 passes

---

### Step 3.3: Browse Map - Thumbnail Pins (Optional)

**Branch:** `feat/v3-map-ux`  
**Commit Message:** `feat(frontend): use thumbnail pins on browse map if applicable`

#### Agent Instructions

1. If browse map shows route markers (e.g. route center point), consider whether thumbnail pins apply. Per PRD, thumbnail pins are for route detail map with photos. Browse may show route-level markers; no change needed unless routes have a representative photo.
2. If route cards in list view show a cover photo, ensure that works. Otherwise skip or document as future enhancement.

#### Design Constraints

- [PRD v3 - FR-R4](./PRD_v3.md#fr-r4-thumbnail-pins-on-map) — primary context is route detail map.

#### Definition of Done

- [ ] Route detail map uses thumbnail pins (Step 3.1)
- [ ] Browse map behavior verified (no regression)

---

### Step 3.4: Map UX Polish

**Branch:** `feat/v3-map-ux`  
**Commit Message:** `feat(frontend): polish map UX - loading states, cluster styling`

#### Agent Instructions

1. Loading state: show blue dot placeholder until thumbnail loads
2. Cluster icon: count badge readable; styling matches app
3. Ensure no regression: route polyline, click pin → select photo in gallery

#### Definition of Done

- [ ] Loading states work
- [ ] No regressions
- [ ] Map UX meets PRD acceptance criteria

---

## Phase 4: Route Management

**Goal:** Bulk reorder photos, add/remove photos from routes.

**Design Reference:** [PRD v3 - FR-R5](./PRD_v3.md#fr-r5-bulk-reorder-photos), [FR-R6](./PRD_v3.md#fr-r6-addremove-photos-from-routes)

---

### Step 4.1: Photo Reorder API and Service

**Branch:** `feat/v3-route-mgmt`  
**Commit Message:** `feat(backend): add PATCH /v1/routes/{id}/photos/order, recompute geometry`

#### Agent Instructions

1. Implement `PATCH /v1/routes/{route_id}/photos/order`:
   - Body: `{ "photo_ids": string[] }` — ordered list
   - Validate: all photo_ids belong to route; user owns route
   - Update route_photos.display_order for each
   - Call `recompute_route_geometry_from_photos(route_id)`
   - Return updated photos
2. Implement `DELETE /v1/routes/{route_id}/photos/{photo_id}`:
   - Remove route_photo association
   - Recompute route geometry
   - If <2 photos remain: either block (400) or set route to draft per product decision; document choice

#### Design Constraints

- [PRD v3 - API - Photo Reorder, Remove](./PRD_v3.md#photo-reorder)

#### Unit Tests

- PATCH photos/order updates display_order and route geometry
- DELETE route photo removes association and recomputes geometry
- DELETE when 1 photo remains: behavior per product decision (block or draft)

#### UAT

- **UAT-FR-R5.1:** PATCH photos/order → order updated, route geometry recomputed
- **UAT-FR-R6.1:** DELETE route photo → photo removed from route, geometry recomputed

#### Definition of Done

- [ ] Endpoints implemented
- [ ] Integration tests pass

---

### Step 4.2: Bulk Reorder Frontend

**Branch:** `feat/v3-route-mgmt`  
**Commit Message:** `feat(frontend): add drag-and-drop bulk reorder for photos`

#### Agent Instructions

1. Update PhotoGallery (or route detail gallery): add drag-and-drop reordering
2. Use library (e.g. @dnd-kit/core, react-beautiful-dnd) or native HTML5 drag-and-drop
3. On reorder: call PATCH /v1/routes/{id}/photos/order with new order
4. Optimistic update: reflect new order in UI immediately; revert on API error

#### Design Constraints

- [PRD v3 - FR-R5](./PRD_v3.md#fr-r5-bulk-reorder-photos)

#### UAT

- **UAT-FR-R5 (Full):** As a user, I can reorder photos by drag-and-drop
  - Drag photo to new position → order updates → route geometry updates (visible on map)

#### Definition of Done

- [ ] Drag-and-drop works
- [ ] API called on reorder
- [ ] UAT-FR-R5 passes

---

### Step 4.3: Add/Remove Photos Frontend

**Branch:** `feat/v3-route-mgmt`  
**Commit Message:** `feat(frontend): add remove-photo-from-route, improve add-photo flow`

#### Agent Instructions

1. Route detail: add "Remove from route" to photo context menu or edit modal
2. On remove: confirm; call DELETE /v1/routes/{id}/photos/{photo_id}; refresh route
3. If removing would leave <2 photos: show message and block, or convert to draft per product decision
4. Add photo: existing flow (PhotoUploadForm) already adds; ensure new photos get correct display_order and route geometry recomputes

#### Design Constraints

- [PRD v3 - FR-R6](./PRD_v3.md#fr-r6-addremove-photos-from-routes)

#### UAT

- **UAT-FR-R6 (Full):** As a user, I can add and remove photos from routes
  - Add photo to route → photo appears, route geometry updates
  - Remove photo → photo removed, route geometry updates
  - Remove when 2 photos → blocked or draft per product decision

#### Definition of Done

- [ ] Remove photo works
- [ ] Add photo works (existing flow validated)
- [ ] UAT-FR-R6 passes

---

## Phase 5: Export & Drafts

**Goal:** GPX export, route drafts (save, list, publish, delete).

**Design Reference:** [PRD v3 - FR-R7](./PRD_v3.md#fr-r7-export-gpx-with-photo-waypoints), [FR-R10](./PRD_v3.md#fr-r10-route-drafts)

---

### Step 5.1: GPX Export Backend

**Branch:** `feat/v3-export-drafts`  
**Commit Message:** `feat(backend): add GET /v1/routes/{slug}/gpx endpoint`

#### Agent Instructions

1. Implement `GET /v1/routes/{slug}/gpx`:
   - Return `application/gpx+xml`
   - Auth: optional for public routes; required for private (owner only)
   - Build GPX: route as `<trk>`, photo locations as `<wpt>` (waypoints)
   - Waypoint name: caption or "Photo N"
   - Filename: `Content-Disposition: attachment; filename="{slug}.gpx"`
2. Use Python GPX library (e.g. gpxpy) or generate XML manually
3. Exclude photos without location from waypoints

#### Design Constraints

- [PRD v3 - FR-R7](./PRD_v3.md#fr-r7-export-gpx-with-photo-waypoints)
- GPX compatible with Google Maps import

#### Unit Tests

- GET /v1/routes/{slug}/gpx returns valid GPX XML
- GPX contains track and waypoints
- Private route: 403 when not owner

#### UAT

- **UAT-FR-R7.1:** GET /v1/routes/{slug}/gpx returns GPX file; import to Google Maps works

#### Definition of Done

- [ ] Endpoint implemented
- [ ] GPX valid and importable
- [ ] Integration tests pass

---

### Step 5.2: GPX Export Frontend

**Branch:** `feat/v3-export-drafts`  
**Commit Message:** `feat(frontend): add Export GPX button on route detail`

#### Agent Instructions

1. Add "Export GPX" button on route detail page (for owner or public route viewer)
2. On click: open GET /v1/routes/{slug}/gpx in new tab or trigger download
3. Filename: `{slug}.gpx`

#### UAT

- **UAT-FR-R7 (Full):** As a user, I can export a route as GPX
  - Click Export GPX → file downloads → open in Google Maps shows route and waypoints

#### Definition of Done

- [ ] Export button works
- [ ] UAT-FR-R7 passes

---

### Step 5.3: Drafts Backend

**Branch:** `feat/v3-export-drafts`  
**Commit Message:** `feat(backend): add draft endpoints - POST/GET drafts, publish, delete`

#### Agent Instructions

1. Implement `POST /v1/drafts`:
   - Body: similar to route create; route_geometry may be empty or partial; photo_ids optional
   - Create route with is_draft=true, slug=draft-{uuid}
   - Associate photos if provided
2. Implement `GET /v1/drafts`: return current user's drafts (is_draft=true)
3. Implement `PATCH /v1/drafts/{id}/publish`:
   - Validate ≥2 photos with location
   - Set is_draft=false; generate real slug; update geometry from photos
   - Return published route
4. Implement `DELETE /v1/drafts/{id}`: delete draft route (cascade route_photos)
5. Exclude drafts from browse (GET /v1/routes); exclude from route by slug unless owner

#### Design Constraints

- [PRD v3 - FR-R10](./PRD_v3.md#fr-r10-route-drafts)
- [PRD v3 - API - Route Drafts](./PRD_v3.md#route-drafts)

#### Unit Tests

- POST /v1/drafts creates draft
- GET /v1/drafts returns only user's drafts
- PATCH publish validates and converts to route
- DELETE removes draft

#### UAT

- **UAT-FR-R10.1:** POST /v1/drafts → draft created; GET /v1/drafts returns it
- **UAT-FR-R10.2:** PATCH publish with valid data → route published
- **UAT-FR-R10.3:** Publish with <2 photos → 400

#### Definition of Done

- [ ] Draft endpoints implemented
- [ ] Integration tests pass

---

### Step 5.4: Drafts Frontend

**Branch:** `feat/v3-export-drafts`  
**Commit Message:** `feat(frontend): add draft save, list, publish, delete`

#### Agent Instructions

1. Create route flow: add "Save draft" button; call POST /v1/drafts
2. Add "Drafts" section to My Routes or dashboard; list drafts via GET /v1/drafts
3. Draft detail/edit page: allow adding photos, finishing route; "Publish" calls PATCH /v1/drafts/{id}/publish
4. "Discard" calls DELETE /v1/drafts/{id}
5. Drafts not shown in browse

#### Design Constraints

- [PRD v3 - FR-R10](./PRD_v3.md#fr-r10-route-drafts)

#### UAT

- **UAT-FR-R10 (Full):** As a user, I can save work-in-progress as a draft
  - Save draft with partial photos → draft saved
  - Open draft later → add photos → Publish → route created
  - Discard draft → draft deleted

#### Definition of Done

- [ ] Save draft works
- [ ] List drafts works
- [ ] Publish works
- [ ] UAT-FR-R10 passes

---

## UAT Master Checklist (v3)

| ID | User Story | Steps | Status |
|----|------------|-------|--------|
| UAT-FR-R1 | Photo-first route creation | 2.4 | |
| UAT-FR-R2 | Strict route-photo consistency | 2.1, 2.3, 4.1 | |
| UAT-FR-R3 | Photos without location + location editing | 1.4 | |
| UAT-FR-R4 | Thumbnail pins on map | 3.1 | |
| UAT-FR-R5 | Bulk reorder photos | 4.2 | |
| UAT-FR-R6 | Add/remove photos from routes | 4.3 | |
| UAT-FR-R7 | Export GPX with photo waypoints | 5.2 | |
| UAT-FR-R8 | Photo clustering on map | 3.2 | |
| UAT-FR-R9 | Undo/redo for route drawing | 2.5 | |
| UAT-FR-R10 | Route drafts | 5.4 | |

---

## Git Workflow

- **Branch per phase:** `feat/v3-<phase-name>` (e.g. `feat/v3-foundation`, `feat/v3-photo-first`)
- **Commit per step:** One commit per step, message format `type(scope): description`
- **PR per phase:** Merge `feat/v3-<phase>` into `main` after all steps in phase complete and tests pass
- **Tags:** Optionally tag phases: `v3.1-foundation`, `v3.2-photo-first`, etc.

---

## Agent Quick Reference

When starting a step:

1. **Read** the step's Agent Instructions and Design Constraints
2. **Reference** [PRD v3](./PRD_v3.md) for any ambiguity
3. **Implement** exactly as specified; do not add features
4. **Write** the required Unit Tests and UAT
5. **Verify** Definition of Done before committing
6. **Stop** if a design change is needed; document and request approval

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-06
