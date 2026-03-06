# Bulk Photo Upload & My Photos — Frontend Design

**Date:** 2026-03-06
**Scope:** Frontend only. Backend endpoints (`POST /v1/photos`, `GET /v1/photos/my`) already exist.

---

## Goal

Allow authenticated users to upload hundreds of JPEGs (with EXIF GPS) into their personal photo library, independent of routes, and see them as pins on the map. Make the map feel alive with user-generated content.

---

## Architecture

### 1. API layer (`frontend/src/api/photos.ts`)

Add `getMyPhotosInBbox(bbox, page, per_page)` — hits `GET /v1/photos/my?bbox=...` with auth. Returns the same `PhotosBrowseResponse` shape as the existing `getPhotosInBbox`, so Browse.tsx is type-compatible.

### 2. Browse page map toggle (`frontend/src/pages/Browse.tsx`)

Add `myPhotosMode: boolean` state (default `false`, only activatable when `isAuthenticated`).

- Default (off): calls `getPhotosInBbox` — all public photos, which includes the user's own photos if they're on public routes.
- Toggled (on): calls `getMyPhotosInBbox` — all of the current user's photos regardless of route visibility. Superset filter for the user's personal library.

When the toggle changes, re-fetch immediately with the current bbox. Pin rendering, clustering, and lightbox are unchanged — only the data source differs.

Toggle UI: a small pill button rendered above the map, visible only when authenticated. Labels: "All photos" / "My photos".

### 3. Photos nav panel (`frontend/src/components/explore/ExplorePhotosPanel.tsx`)

New side panel, mirrors `ExploreRoutesPanel` structure exactly:

- Fixed left panel, offset by `NAV_RAIL_WIDTH`, same `z-index` as routes panel.
- Header: "Photos" + close button.
- Filters row: "Upload photos" button (like "Create route" in routes panel).
- Scrollable list of the user's own photos (thumbnail, caption, date), fetched from `GET /v1/photos/my?bbox=` using the same bbox-from-map-viewport pattern.
- Auth-required — panel only accessible when logged in.
- "Upload photos" button: closes the panel, opens the upload `BottomDrawer`.

### 4. Bulk upload component (`frontend/src/components/photos/BulkPhotoUpload.tsx`)

Rendered as the content of a `BottomDrawer`. Multi-file JPEG picker (`multiple` attribute, `accept="image/jpeg,.jpg,.jpeg"`). Each file uploads independently via `uploadPhoto(file, [], null)` (route-free). Per-file status tracked in state: `queued → uploading → done | error`. UI shows a list of filenames with status indicators. Photos missing GPS upload fine but won't appear as map pins — a note informs the user. No per-file caption step (can be edited later via photo patch). On completion, a "Done" button closes the drawer.

### 5. State wiring

Extend `RoutesPanelContext` to carry two new booleans: `photosPanelOpen` / `setPhotosPanelOpen` and `uploadDrawerOpen` / `setUploadDrawerOpen`.

`MapShellLayout` in `App.tsx` renders `ExplorePhotosPanel` and the upload `BottomDrawer` alongside the existing `ExploreRoutesPanel`. The upload `BottomDrawer` triggers a photos panel refresh via a callback passed down from `MapShellLayout`.

### 6. Nav rail (`frontend/src/components/common/DrawerMenu.tsx`)

Add "Photos" button below "Routes". Auth-gated: calls `setPhotosPanelOpen(true)`. No login redirect needed — the button is only shown when `isAuthenticated`.

---

## Files changed

| File | Change |
|---|---|
| `frontend/src/api/photos.ts` | Add `getMyPhotosInBbox` |
| `frontend/src/pages/Browse.tsx` | Add `myPhotosMode` toggle + conditional fetch |
| `frontend/src/components/explore/ExplorePhotosPanel.tsx` | New component |
| `frontend/src/components/photos/BulkPhotoUpload.tsx` | New component |
| `frontend/src/contexts/RoutesPanelContext.tsx` | Extend with photos panel + upload drawer state |
| `frontend/src/components/common/DrawerMenu.tsx` | Add "Photos" nav button |
| `frontend/src/App.tsx` | Render `ExplorePhotosPanel` + upload `BottomDrawer` in `MapShellLayout` |

---

## Out of scope

- Per-photo caption editing (existing PATCH endpoint exists, UI deferred)
- Map-placement step for photos without GPS (uploaded with `location=null`, not shown as pins)
- Drag-and-drop file input (standard multi-file picker only)
- Pagination in ExplorePhotosPanel list (fetch first page; load-more deferred)
- Redesign of the nav rail (user noted this will be revisited)
