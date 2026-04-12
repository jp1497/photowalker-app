# Route Editing Design

**Date:** 2026-03-09
**Status:** Approved

## Summary

Add the ability for route owners to edit a published route from the `RouteDetail` page. Scope: edit metadata (title, description, tags, visibility), reorder photos, delete the route.

## UI Structure

An "Edit" button appears in the route header for the owner. Clicking it toggles `isEditMode`.

**View mode:** Renders exactly as today.

**Edit mode:**
- Title, description, tags become inline editable fields pre-filled with current values
- Public/private toggle checkbox
- "Save changes" and "Cancel" buttons at the top; Cancel reverts all field changes without saving
- Photo gallery replaced by `ReorderablePhotoList` with drag-and-drop handles and ↑/↓ arrow buttons; reorder saves immediately on drop/click (optimistic UI, reverts on error with toast)
- "Add photos" upload button stays available
- "Delete route" danger button at the bottom; requires confirmation before deleting

**After delete:** Navigate to `/browse`.

## Backend Changes

All route metadata endpoints already exist:
- `PATCH /v1/routes/{route_id}` — title, description, tags, is_public (owner only)
- `DELETE /v1/routes/{route_id}` — owner only

**New endpoint:**
```
PUT /v1/routes/{route_id}/photos/order
```
- Auth: owner only
- Body: `{ photo_ids: string[] }` — full ordered list of photo IDs for this route
- Sets `display_order = index` for each `RoutePhoto` row
- Calls existing `recompute_route_geometry_from_photos()` to update the route linestring
- Returns `204 No Content`

## Frontend Changes

**New API functions:**
- `updateRoute(id, patch)` in `api/routes.ts` — `PATCH /v1/routes/{route_id}`
- `deleteRoute(id)` in `api/routes.ts` — `DELETE /v1/routes/{route_id}`
- `reorderRoutePhotos(routeId, photoIds)` in `api/photos.ts` — `PUT /v1/routes/{route_id}/photos/order`

**New components:**
- `RouteEditForm` — inline fields for title, description, tags, is_public with Save/Cancel
- `ReorderablePhotoList` — replaces `PhotoGallery` in edit mode; HTML5 drag-and-drop (no extra library) + ↑/↓ buttons; optimistic reorder with error revert

**`RouteDetail` changes:**
- Add `isEditMode` state; show "Edit" button for owner
- In edit mode, render `RouteEditForm` + `ReorderablePhotoList` instead of read-only content
- Delete confirmation: inline confirm UI (not `window.confirm`); on confirm call `deleteRoute()` then navigate to `/browse`

## Out of Scope

- Editing photo captions (already handled via existing photo patch)
- Editing route geometry (drawing a new line)
- Bulk photo operations
