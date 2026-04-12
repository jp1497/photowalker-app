# Photo Callout Pins — Design

**Date:** 2026-03-08

## Goal

Replace circular photo pins on the browse map with always-visible rectangular callout bubbles that display the photo at its natural aspect ratio and point a triangle tip at the GPS coordinate. The map should feel populated with photos at a glance.

## Behaviour

- All photos in the viewport display simultaneously as callout bubbles — no click required to reveal
- Bubbles overlap freely; clustering/z-order not addressed in this iteration
- Clicking a callout opens the existing lightbox (unchanged)
- On thumbnail load: empty white callout → filled callout with image
- On thumbnail error: empty white callout (no fallback dot)

## Visual shape

```
┌────────────────┐
│                │  white bubble, border-radius: 4px
│   <img />      │  max-width: 120px, max-height: 100px
│                │  object-fit: contain (natural aspect ratio, no crop)
└───────┬────────┘  box-shadow: 0 2px 6px rgba(0,0,0,0.3), border: 2px solid #fff
        ▼           CSS border-trick triangle, white, centered at bottom
        ·           tip anchors to GPS coordinate (MapLibre anchor: 'bottom')
```

## Approach

HTML Markers (one `maplibregl.Marker` per photo). The app already uses this pattern for cluster stacks. At max 50 photos per bbox fetch, DOM overhead is negligible.

Rejected alternatives:
- Canvas-rendered callout bitmaps (symbol layer): raster triangle looks soft; aspect ratio hard to preserve in square canvas
- MapLibre Popup: designed for one-at-a-time; 50 simultaneous popups fights the API

## Files changed

### `frontend/src/components/map/PhotoMarker.tsx`
- Add `createPhotoCalloutElement(onClick?, thumbnailUrl?)` — builds callout DOM (bubble + pointer)
- Add `setCalloutThumbnail(el, url)` — updates an existing callout's `<img>` src in-place
- Existing `createPhotoMarkerElement` / `setMarkerThumbnail` unchanged (used by RouteDetail)

### `frontend/src/pages/Browse.tsx`
- Remove: `addBrowsePhotoImagesToMap`, `BROWSE_PHOTOS_LAYER_ID` symbol layer, `BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL`
- Add: `browsePhotoMarkersRef` tracking active `maplibregl.Marker[]`
- Add: effect to create/teardown markers when `photosToShowOnMap` changes
- Add: effect to call `setCalloutThumbnail` when `browsePhotoThumbnailUrls` updates
- Keep: `browsePhotoThumbnailUrls` state (still needed for in-place image updates)

### `frontend/src/components/map/pinImageUtils.ts`
- No changes (still used by route layer)

## Out of scope

- Clustering / density management (deferred)
- Zoom-based scaling of callout size (deferred)
- Route pins (separate layer, separate iteration)
