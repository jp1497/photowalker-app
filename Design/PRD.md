# Photowalker Product Requirements Document

Single source of truth for the Photowalker product. Written from scratch 2026-04-13 based on the current implemented state and validated product direction.

Previous version archived at [design/history/PRD_v8.md](history/PRD_v8.md).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Authentication & Accounts](#2-authentication--accounts)
3. [Photo Library](#3-photo-library)
4. [Map & Browse Experience](#4-map--browse-experience)
5. [Routes Panel & Discovery](#5-routes-panel--discovery)
6. [Route Detail & Viewing](#6-route-detail--viewing)
7. [Route Creation](#7-route-creation)
8. [Navigation & UI Structure](#8-navigation--ui-structure)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Known Issues](#10-known-issues)
11. [Planned Features](#11-planned-features)
12. [API Reference](#12-api-reference)

---

## 1. Product Overview

### Vision

Photowalker lets photographers upload and share their photos on a map. They can curate routes that inspire others to retrace their steps and see the world through their lens.

### Core Philosophy

- **Photos are primary.** Every geotagged photo is visible on the public map the moment it is uploaded — routes are not a prerequisite for discovery. Routes are the primary way to organise, connect, and share photos.
- **Map-first.** The map is the primary canvas. All UI surfaces (panels, drawers, modals) are overlays on top of it.
- **Local and visual.** The default experience is immediate and geographic — open the app, see what has been photographed near you.

### Personas

| Persona | Description | Auth required |
|---|---|---|
| **Creator** | Uploads photos, builds and publishes routes | Yes |
| **Explorer** | Browses photos and routes, gets inspired, saves routes and engages with the community | Yes |
| **Anonymous Visitor** | Views the public photo map, browses photo pins and their details, reads public routes and galleries — enough to understand the value of the app and be motivated to create an account | No |

---

## 2. Authentication & Accounts

### Requirements

- Sign in with Google OAuth only; one-click flow
- JWT access token (15 min); HTTP-only refresh cookie (7 days)
- Session persists across page reloads via token refresh
- Sign out clears the refresh cookie
- Authenticated users can update their name and default map location

### What requires authentication

- Uploading photos
- Creating and editing routes
- Accessing the Photos panel (personal library)
- Future: saving routes, commenting

### Anonymous access

- Full read access to the public photo map and all public routes
- No account-gated paywalls or content restrictions on public content

### Known issues

- Sign out does not server-side invalidate the refresh token — a stolen token remains valid for 7 days post-logout
- `test-login` E2E endpoint is always registered in OpenAPI regardless of config
- Refresh cookie `secure` flag is `False` in non-production environments
- `initPromise` persists across logout/re-login in the same session — re-init is skipped

---

## 3. Photo Library

### Core behaviour

- Any authenticated user can upload JPEG photos (max 10MB each)
- Photos with EXIF GPS are automatically plotted on the map at upload
- Photos without EXIF GPS are accepted and stored — they appear in the user's library but not on the public map until a location is manually assigned
- All geotagged photos from all users are visible on the public map, regardless of whether they belong to a route
- A thumbnail is generated asynchronously after upload (RQ worker, stored in S3)
- Photos can belong to zero, one, or many routes

### Bulk upload

- Creators can upload multiple photos at once to their library without creating a route
- Per-file upload status is shown (queued, uploading, done, failed)
- This is a standalone flow — not tied to route creation

### Photos panel

- Authenticated users can view their own photo library in the Photos panel
- The panel shows the user's photos within the current map viewport
- An "Upload photos" button in the panel opens the bulk upload flow
- The panel updates as the user moves the map
- **Known bug:** The Photos panel is currently implemented but not displaying photos

### Photo management

- Creators can edit a photo's caption and location at any time
- Editing a photo's location that belongs to a route triggers route geometry recomputation
- Creators can delete a photo globally (removes it from all routes and the map)

### Limits

- Max 10MB per photo
- JPEG only

### Known issues

- Photo upload in the route creation flow is sequential — should use concurrent upload with a concurrency limit
- S3 delete errors are silently swallowed — should log at warning level

---

## 4. Map & Browse Experience

### First impression

- The app opens centred on the user's current location (or a sensible default)
- Photo pins are immediately visible for all geotagged photos in the viewport
- No sign-in required to browse

### Photo pins

- Each geotagged photo appears as a thumbnail pin on the map
- Clicking a pin opens a lightbox showing: the photo, the photographer's name, and any routes the photo belongs to
- From the lightbox, a user can navigate to any of those routes
- Pin density updates as the user pans and zooms

### Route highlighting

- When a route is hovered or selected in the Routes panel, its polyline is highlighted on the map and its photos are visually emphasised
- **Known bug:** Route highlighting is currently broken and must be fixed

### Welcome experience

- First-time anonymous visitors see a welcome modal explaining the app
- The modal is dismissible and does not reappear in the same session (sessionStorage)
- The modal is a conversion touchpoint — it should clearly communicate the value of signing up

### Navigation

- The nav rail (left edge) has three items: **Browse**, **Routes**, **Photos** (auth-gated)
- Browse closes any open panel and returns to the plain map view
- Open question: "Browse" as a dedicated nav item may be redundant and should be reviewed

---

## 5. Routes Panel & Discovery

### Routes panel

- Accessible from the nav rail; slides in from the left over the map
- Shows a filterable, paginated list of routes
- Filters: **All routes** (public) and **My routes** (auth-gated)
- Route cards show: thumbnail, title, author, distance, tags
- Hovering a route card highlights that route on the map
- Clicking a route card opens the route in the bottom drawer and shows the route polyline and photo pins on the map
- A **Create route** button is present in the panel (auth-gated; prompts sign-in if anonymous)

### Discovery

- Routes are sortable by date (default) or distance
- Routes can be filtered by tags and author
- Browse is bbox-aware — routes shown reflect the current map viewport
- Public routes are discoverable by anyone without an account

### My routes

- "My routes" is a filter within the Routes panel — there is no separate `/routes/me` page
- Authenticated users can see their own public and private routes under this filter

### Known issues

- Route highlight on hover is currently broken

---

## 6. Route Detail & Viewing

### Route detail experience

- Routes are accessible at `/routes/:slug` — publicly shareable URL
- The route opens in a bottom drawer (peek and expanded states) with the map showing the route polyline and photo pins
- The drawer presents the route as a curated gallery — the experience should feel polished and editorial, not a plain list
- Route metadata displayed: title, description, author, distance, tags, date published

### Gallery

- Photos are displayed in their curated display order
- Clicking a photo opens the full lightbox
- The gallery is the centrepiece of the route detail — this area requires significant design work to feel like a proper photographic presentation

### Access control

- Public routes: visible to anyone
- Private routes: visible to the owner only; returns 403 to all others
- Invalid slug: returns 404

### Owner actions

- Edit title, description, and tags
- Reorder photos (drag-and-drop)
- Delete the route (with confirmation)
- Edit individual photo locations (MapPicker)

### Known issues

- The route gallery in the bottom drawer needs significant UX improvement to feel curated
- Modal backdrop clears only error state — the edit location modal stays open on backdrop click (`RouteDetail.tsx:246`)

---

## 7. Route Creation

### Entry point

- The **Create route** button in the Routes panel is the only entry point (auth-gated)
- Route creation opens in the bottom drawer

### Two creation paths

**Path A — Upload new photos**
- Creator uploads one or more JPEGs directly into the creation flow
- Photos with EXIF GPS are auto-plotted on the map
- Photos without GPS must have a location manually assigned (MapPicker) before publishing
- Creator reorders photos to define the walk sequence
- Backend derives the route LineString geometry from ordered photo locations and computes distance

**Path B — Select from existing library (planned)**
- Creator selects photos already in their library to build a route
- Same ordering, location, and publishing rules apply as Path A
- Not yet implemented — high priority planned feature

### Reordering

- Photos are reordered to define the sequence of the walk
- Current reorder UX is considered clunky and needs improvement
- A keyboard alternative for reorder is required (WCAG 2.1)

### Route metadata

- Title (required, 1–100 characters)
- Description (optional)
- Tags (optional, max 5)
- Visibility: private by default; publishing makes the route public

### Validation

- At least 2 photos with assigned locations required to publish
- All photos in the route must have a location before publishing

### Known issues

- Reorder UX needs improvement — drag-and-drop feels clunky
- No keyboard alternative for reorder (WCAG 2.1 SC 2.1.1 failure)

---

## 8. Navigation & UI Structure

### Layout

- The map is always the primary canvas — full viewport (100vw × 100vh)
- All UI surfaces are overlays on top of the map
- Structured for future mobile conversion — rem/% sizing, touch targets ≥44px

### Nav rail

- Fixed to the left edge; always visible
- Three items: **Browse**, **Routes**, **Photos** (Photos is auth-gated)
- Browse: closes all panels and returns to the plain map
- Routes: opens the Routes panel
- Photos: opens the Photos panel (authenticated users only)
- Open question: "Browse" as a nav item may be redundant — to be reviewed

### Account icon

- Fixed to the top-right corner; always visible
- Contains: Sign in (if anonymous), Settings, Sign out
- Settings is currently a stub — to be built out as account and library management

### Bottom drawer

- Shared component for route detail and route creation
- Supports peek (partial) and expanded states
- Dismissible; returns user to the map

### Map modes

| Mode | Path | Map content |
|---|---|---|
| `home` | `/` (redirects to `/browse`) | — |
| `browse-photos` | `/browse` | Photo pins in viewport; route highlight when panel route is hovered |
| `detail` | `/routes/:slug` | Route polyline + photo pins for that route |
| `create` | `/routes/create` | Preview markers during route building |

### Known issues

- `AccountIcon` touch target is 40px — must be increased to ≥44px (WCAG 2.1)
- `ErrorBoundary` renders raw stack trace to end users in production — must be guarded by environment

---

## 9. Non-Functional Requirements

### Performance

- Map load: <2s
- Thumbnail load: <500ms
- API p95 response time: <200ms

### Storage & limits

- Max 10MB per photo
- JPEG only
- Max 50 photos per route
- Soft limits per user: 100 routes, 5GB total storage

### Rate limiting

- 100 requests/min — anonymous users
- 500 requests/min — authenticated users
- 10 photo uploads/min per user
- Currently in-memory (per-process) — Redis required for multi-worker production deployments

### Security

- JWT access tokens: 15 min expiry
- Refresh token: 7 days, HTTP-only cookie
- HTTPS in production
- CORS restricted to frontend origin
- `SECRET_KEY` must be ≥32 characters (currently no enforcement — P0 issue)

### Accessibility

- Touch targets ≥44px (WCAG 2.1)
- Keyboard navigable — all interactive elements reachable without a mouse
- Screen reader compatible — interactive elements must not be `aria-hidden`

### Testing

- Backend: unit tests + integration tests for all endpoints
- Frontend: component and hook unit tests; E2E for critical flows
- Target: ≥80% unit test coverage (currently not enforced in CI)

---

## 10. Known Issues

Issues are drawn from the codebase review (2026-03-06) and subsequent development. Some may have been resolved since the review — each should be verified before marking closed.

### P0 — Security (ship blockers)

| Issue | Location |
|---|---|
| `SECRET_KEY` has no minimum-length validation — weak key makes all JWTs forgeable | `core/config.py:26` |
| Health endpoints return raw exception strings — exposes DB hostnames and S3 ARNs to unauthenticated callers | `api/v1/health.py:32-54` |

### P1 — Functionality

| Issue | Location |
|---|---|
| Photos panel not displaying photos | `ExplorePhotosPanel.tsx` |
| Route highlight on hover broken | `Browse.tsx` / `HighlightedRouteContext` |
| Sign out does not server-side invalidate the refresh token | `api/v1/auth.py:163-171` |
| `test-login` endpoint always registered in OpenAPI regardless of config | `api/v1/auth.py:80-116` |
| Refresh cookie `secure=False` in non-production | `api/v1/auth.py:72` |
| `X-Forwarded-For` uses rightmost IP — rate limiting ineffective behind load balancer | `middleware/rate_limit.py:76-82` |
| S3 delete errors silently swallowed on photo deletion | `services/photo_service.py:345-353` |
| Thumbnail worker crashes on corrupt images — causes infinite RQ retries | `utils/thumbnail.py:20` |
| `refreshPromise` race condition for concurrent 401s | `api/client.ts:60-79` |
| `initPromise` persists across logout/re-login — re-init skipped in same session | `hooks/useAuth.ts:6` |
| `clearUser()` does not clear component-level cached data on user switch | `store/authStore.ts:22` |
| `Browse.tsx` pagination has no `.catch()` — silent failure, stale data shown | `pages/Browse.tsx:784-795` |
| `RouteDetail.tsx` refetch has no error handling | `pages/RouteDetail.tsx:70-73` |
| Modal backdrop clears error state only — edit location modal stays open on backdrop click | `pages/RouteDetail.tsx:246` |
| `ErrorBoundary` renders raw stack trace to end users in production | `components/common/ErrorBoundary.tsx:44-49` |
| `Browse.tsx` is ~958 lines mixing five distinct concerns — extract into hooks | `pages/Browse.tsx` |
| Deprecated `@app.on_event` — migrate to lifespan | `core/factory.py:42-54` |
| In-memory rate limit store is per-process — Redis required in production | `middleware/rate_limit.py:64-72` |

### P1 — Accessibility

| Issue | Location |
|---|---|
| Drag-and-drop photo reorder has no keyboard alternative (WCAG 2.1 SC 2.1.1) | `pages/CreateRouteFromPhotos.tsx:554-558` |
| Cluster markers are `aria-hidden` but interactive | `pages/Browse.tsx:124` |

### P2 — Tech debt & minor issues

| Issue | Location |
|---|---|
| `AccountIcon` touch target is 40px — must be ≥44px | `components/common/AccountIcon.tsx:42-56` |
| No runtime validation of API responses — TypeScript casts only | `api/client.ts` et al. |
| `Route` frontend type missing `is_draft` field | `types/route.ts` |
| `RouteResponse.is_draft` has hardcoded default `= False` | `schemas/route.py:108` |
| `Photo.captured_at` stored as timezone-naive datetime | `utils/exif.py:76` |
| `User.default_map_lat/lon` have no range constraints | `models/user.py:30-31` |
| `_bbox_area_m2` duplicated across discovery and photo services | `services/` |
| `auth_service.logout()` is dead code | `services/auth_service.py:74-76` |
| `ensure_unique_slug` sync variant is dead code | `utils/slug.py:35-53` |
| `photo_service` imports from schemas layer — dependency inversion | `services/photo_service.py:278` |
| `Settings.tsx` is a placeholder stub | `pages/Settings.tsx` |
| `useRoutes.ts` and `useMap.ts` are empty stubs | `hooks/` |
| Map/List toggle buttons have no `aria-pressed` state | `pages/Browse.tsx:891-916` |
| No CI coverage gate enforcing ≥80% unit coverage | CI config |

### Test coverage gaps (P1)

| Gap | Risk |
|---|---|
| `useAuth` hook has zero test coverage | High |
| `PhotoUploadForm` has zero test coverage | High |
| `thumbnail_job.py` orchestration entirely untested | High |
| All service tests (`route_service`, `photo_service`, `discovery_service`) gated behind Postgres — zero unit coverage | High |
| Integration: PATCH/DELETE route success paths not tested | Medium |
| Integration: DELETE photo success and 404 not tested | Medium |
| Integration: private route exclusion from `GET /v1/routes` not tested | Medium |

---

## 11. Planned Features

Features are ordered roughly by priority. None are committed to a timeline.

### High priority

| Feature | Description |
|---|---|
| Route creation from existing library photos | Creator selects photos already uploaded to their library to build a route, rather than uploading fresh |
| Unified upload flow | The two upload paths (standalone library upload and route creation upload) should feel like a single coherent experience |
| Route gallery redesign | The route detail bottom drawer should present photos as a curated, polished gallery — the centrepiece of the route experience |
| Route highlight fix | Hovering a route card in the Routes panel should reliably highlight that route on the map |
| Photos panel fix | The Photos panel should correctly display the user's photos in the current viewport |
| GPX export | `GET /v1/routes/{slug}/gpx` returns a GPX file with the route track and photo waypoints; export button in route detail view |

### Medium priority

| Feature | Description |
|---|---|
| Settings page | Account management, photo library management, preferences |
| Photo clustering | Intelligent clustering of dense photo pins at lower zoom levels; design TBD |
| Remove photo from route | Dissociate a photo from a route without deleting it globally; requires ≥2 photos to remain |
| Reorder photos on existing routes | Edit the photo order on an already-published route via the route detail view |
| Anonymous visitor conversion | Welcome modal and sign-up prompts optimised for conversion |

### Future / lower priority

| Feature | Description |
|---|---|
| Saving routes | Authenticated Explorers can save routes to a personal collection |
| Comments | Explorers can comment on routes |
| User profiles | Public profile pages showing a creator's routes and photos |
| Following | Explorers can follow creators |
| Social sharing | Share a route to external platforms beyond the public URL |
| Search | Text search for routes, photographers, and locations |
| Mobile app | Native iOS/Android experience |
| Recommendations & trending | Algorithmically surfaced routes and photographers |

---

## 12. API Reference

Full contract: [shared/openapi.yaml](../shared/openapi.yaml) (canonical at `/openapi.json` when running).

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /v1/auth/google | — | Exchange Google OAuth code for JWT + refresh cookie |
| POST | /v1/auth/refresh | — | Refresh access token via cookie |
| POST | /v1/auth/logout | — | Clear refresh token cookie |
| GET | /v1/auth/me | Required | Current user |
| PATCH | /v1/auth/me | Required | Update name, default map location |
| GET | /v1/routes | — | Browse public routes (bbox, tags, author_id, page, per_page, sort) |
| POST | /v1/routes/from-photos | Required | Create route from ordered photo list |
| GET | /v1/routes/me | Required | Current user's routes |
| GET | /v1/routes/{slug} | Optional | Route detail with photos (public or owner) |
| GET | /v1/routes/{route_id}/photos | Optional | Photos for a route (ordered) |
| PUT | /v1/routes/{route_id}/photos/order | Required | Reorder photos in a route (owner only) |
| PATCH | /v1/routes/{route_id} | Required | Update route title/description/tags/visibility |
| DELETE | /v1/routes/{route_id} | Required | Delete route (owner only) |
| GET | /v1/photos | — | Geotagged photos in bbox (public map pins) |
| POST | /v1/photos | Required | Upload photo (multipart, JPEG, max 10MB) |
| GET | /v1/photos/my | Required | Current user's photos in bbox |
| PATCH | /v1/photos/{photo_id} | Required | Update caption, location, or route associations |
| DELETE | /v1/photos/{photo_id} | Required | Delete photo globally (owner only) |
| GET | /v1/photos/{photo_id}/image | Optional | Photo image (original or thumbnail variant) |
| GET | /health | — | Application health check |
| GET | /health/db | — | Database connectivity check |
| GET | /health/storage | — | S3 storage connectivity check |
