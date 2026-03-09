# Photo Callout Pins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace circular photo pins on the browse map with always-visible rectangular callout bubbles displaying the photo at its natural aspect ratio, pointing at the GPS coordinate.

**Architecture:** Each photo pin becomes an `maplibregl.Marker` with a custom DOM element — a white rounded-rectangle bubble containing the photo, with a CSS triangle pointer at the bottom anchored to the GPS coordinate. The existing MapLibre symbol layer (`browse-photos-layer`) is removed entirely and replaced with per-marker HTML elements managed in a ref array, following the same pattern as cluster stack markers.

**Tech Stack:** MapLibre GL JS, TypeScript, React 19, Vitest (tests)

---

### Task 1: Add callout DOM helpers to PhotoMarker.tsx

**Files:**
- Modify: `frontend/src/components/map/PhotoMarker.tsx`
- Test: `frontend/src/components/map/PhotoMarker.test.ts`

**Step 1: Write failing tests**

Add to the bottom of `frontend/src/components/map/PhotoMarker.test.ts`:

```ts
describe('createPhotoCalloutElement', () => {
  it('renders bubble and pointer elements', () => {
    const el = createPhotoCalloutElement();
    expect(el.classList.contains('photo-callout')).toBe(true);
    expect(el.querySelector('.photo-callout-bubble')).toBeTruthy();
    expect(el.querySelector('.photo-callout-pointer')).toBeTruthy();
  });

  it('without thumbnailUrl renders no img', () => {
    const el = createPhotoCalloutElement();
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('with thumbnailUrl renders img inside bubble', () => {
    const el = createPhotoCalloutElement(undefined, 'https://example.com/thumb.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain('example.com/thumb.jpg');
  });

  it('with onClick attaches click handler', () => {
    const onClick = vi.fn();
    const el = createPhotoCalloutElement(onClick);
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('setCalloutThumbnail', () => {
  it('adds img to bubble when none exists', () => {
    const el = createPhotoCalloutElement();
    expect(el.querySelector('img')).toBeFalsy();
    setCalloutThumbnail(el, 'https://example.com/photo.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain('example.com/photo.jpg');
  });

  it('is no-op when thumbnailUrl is empty', () => {
    const el = createPhotoCalloutElement();
    setCalloutThumbnail(el, '');
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('is no-op when img already exists', () => {
    const el = createPhotoCalloutElement(undefined, 'https://a.com/1.jpg');
    setCalloutThumbnail(el, 'https://b.com/2.jpg');
    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as HTMLImageElement).src).toContain('a.com/1.jpg');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm run test -- PhotoMarker
```

Expected: FAIL — `createPhotoCalloutElement` and `setCalloutThumbnail` are not exported.

**Step 3: Implement the callout helpers**

Add to the bottom of `frontend/src/components/map/PhotoMarker.tsx`:

```ts
const CALLOUT_MAX_WIDTH = 120;
const CALLOUT_MAX_HEIGHT = 100;
const CALLOUT_POINTER_SIZE = 8; // half-width and full-height of the CSS triangle

const calloutBubbleStyle = [
  `max-width: ${CALLOUT_MAX_WIDTH}px;`,
  `max-height: ${CALLOUT_MAX_HEIGHT}px;`,
  'background: #fff;',
  'border-radius: 4px;',
  'border: 2px solid #fff;',
  'box-shadow: 0 2px 6px rgba(0,0,0,0.3);',
  'overflow: hidden;',
  'display: flex;',
  'align-items: center;',
  'justify-content: center;',
  'min-width: 20px;',
  'min-height: 16px;',
].join(' ');

const calloutPointerStyle = [
  'display: block;',
  'width: 0; height: 0;',
  `border-left: ${CALLOUT_POINTER_SIZE}px solid transparent;`,
  `border-right: ${CALLOUT_POINTER_SIZE}px solid transparent;`,
  `border-top: ${CALLOUT_POINTER_SIZE}px solid #fff;`,
  'margin: 0 auto;',
  'filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));',
].join(' ');

const calloutImgStyle = [
  `max-width: ${CALLOUT_MAX_WIDTH}px;`,
  `max-height: ${CALLOUT_MAX_HEIGHT}px;`,
  'display: block;',
  'object-fit: contain;',
].join(' ');

/**
 * Creates a callout-bubble DOM element for a photo map pin.
 * The bottom tip of the pointer aligns with the GPS coordinate (use MapLibre anchor: 'bottom').
 * If thumbnailUrl is provided, renders the image at its natural aspect ratio.
 * Otherwise renders an empty white box placeholder.
 */
export function createPhotoCalloutElement(onClick?: () => void, thumbnailUrl?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'photo-callout';
  el.style.cssText = 'cursor: pointer; display: flex; flex-direction: column; align-items: center;';

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  const bubble = document.createElement('div');
  bubble.className = 'photo-callout-bubble';
  bubble.style.cssText = calloutBubbleStyle;

  if (thumbnailUrl) {
    const img = document.createElement('img');
    img.alt = '';
    img.style.cssText = calloutImgStyle;
    img.src = thumbnailUrl;
    bubble.appendChild(img);
  }

  const pointer = document.createElement('div');
  pointer.className = 'photo-callout-pointer';
  pointer.style.cssText = calloutPointerStyle;

  el.appendChild(bubble);
  el.appendChild(pointer);
  return el;
}

/**
 * Sets the thumbnail image on an existing callout element.
 * No-op if thumbnailUrl is empty or an image already exists.
 */
export function setCalloutThumbnail(el: HTMLElement, thumbnailUrl: string): void {
  if (!thumbnailUrl) return;
  const bubble = el.querySelector('.photo-callout-bubble');
  if (!bubble || bubble.querySelector('img')) return;

  const img = document.createElement('img');
  img.alt = '';
  img.style.cssText = calloutImgStyle;
  img.src = thumbnailUrl;
  bubble.appendChild(img);
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test -- PhotoMarker
```

Expected: All tests PASS (both old and new describe blocks).

---

### Task 2: Replace symbol layer with HTML callout markers in Browse.tsx

**Files:**
- Modify: `frontend/src/pages/Browse.tsx`

No unit tests for this task — the changes are MapLibre integration that requires a live map. Manual verification steps are at the end.

**Step 1: Update imports**

At the top of `Browse.tsx`, replace the `pinImageUtils` import block:

```ts
// REMOVE these imports (no longer needed for browse-photos layer):
import {
  browsePinIconSizeAtZoom,
  createDefaultPinImageData,
  imageToPinImageData,
  MAP_PIN_RASTER_SIZE,
  PIN_ICON_SIZE,
} from '../components/map/pinImageUtils';

// ADD these imports:
import { createPhotoCalloutElement, setCalloutThumbnail } from '../components/map/PhotoMarker';
```

Note: `pinImageUtils` imports are still used by the route layer elsewhere in the file — check before removing. If `addImagesToMap` (routes layer) still references them, keep `createDefaultPinImageData`, `imageToPinImageData`, and `PIN_ICON_SIZE` but remove `MAP_PIN_RASTER_SIZE`, `browsePinIconSizeAtZoom`.

**Step 2: Remove BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL and related state**

Remove the constant:
```ts
// REMOVE:
const BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL = true;
```

Remove the `photosToShowOnMap` memo that filters on it — replace with a direct alias:
```ts
// REMOVE:
const photosToShowOnMap = useMemo(() => {
  if (!BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL) return browsePhotos;
  return browsePhotos.filter((p) => !!browsePhotoThumbnailUrls[p.id]);
}, [browsePhotos, browsePhotoThumbnailUrls]);

// ADD (simple alias — all photos show immediately):
const photosToShowOnMap = browsePhotos;
```

**Step 3: Add browsePhotoMarkersRef**

Near the other refs (around line 184, next to `clusterMarkersRef`):
```ts
const browsePhotoMarkersRef = useRef<maplibregl.Marker[]>([]);
```

**Step 4: Remove addBrowsePhotoImagesToMap callback**

Delete the entire `addBrowsePhotoImagesToMap` useCallback (lines ~429-459 in the original). Also remove the two `useEffect` calls that reference it:
- The effect at ~641: `if (!isShellMap || !map?.getSource(...)) return; addBrowsePhotoImagesToMap(map);`
- The effect at ~643: `}, [isShellMap, browsePhotoThumbnailUrls, addBrowsePhotoImagesToMap]);`

**Step 5: Replace the browse-photos symbol layer effect with HTML markers**

Remove the large `useEffect` block that creates the `BROWSE_PHOTOS_SOURCE_ID` source and `BROWSE_PHOTOS_LAYER_ID` layer (lines ~542-628).

Replace with two new effects:

```ts
/** Create/teardown callout markers when the photo list changes. */
useEffect(() => {
  const map = mapRef.current;
  if (!isShellMap || !map) return;

  // Teardown previous markers
  browsePhotoMarkersRef.current.forEach((m) => {
    try { m.remove(); } catch { /* ignore */ }
  });
  browsePhotoMarkersRef.current = [];

  if (!mapReady) return;

  photosToShowOnMap.forEach((photo) => {
    const loc = photo.location;
    if (!loc || loc.type !== 'Point' || !loc.coordinates?.length) return;
    const [lng, lat] = loc.coordinates as [number, number];
    const thumbnailUrl = browsePhotoThumbnailUrlsRef.current[photo.id] || undefined;
    const el = createPhotoCalloutElement(() => {
      setSelectedPhotoForLightbox({
        id: photo.id,
        caption: photo.caption ?? null,
        userName: photo.user.name,
        routeSlugs: photo.routes ?? [],
      });
    }, thumbnailUrl);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);
    browsePhotoMarkersRef.current.push(marker);
  });

  return () => {
    browsePhotoMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch { /* ignore */ }
    });
    browsePhotoMarkersRef.current = [];
  };
}, [isShellMap, mapReady, photosToShowOnMap]);

/** Update callout images in-place as thumbnails arrive (avoids full marker rebuild). */
useEffect(() => {
  if (!isShellMap) return;
  browsePhotoMarkersRef.current.forEach((marker, i) => {
    const photo = photosToShowOnMap[i];
    if (!photo) return;
    const url = browsePhotoThumbnailUrls[photo.id];
    if (url) setCalloutThumbnail(marker.getElement(), url);
  });
}, [isShellMap, browsePhotoThumbnailUrls, photosToShowOnMap]);
```

**Step 6: Remove the highlight/fade effect for BROWSE_PHOTOS_LAYER_ID**

Remove the effect that calls `map.setPaintProperty(BROWSE_PHOTOS_LAYER_ID, 'icon-opacity', ...)` — this was symbol-layer-only. The callout markers don't need opacity fading (out of scope for this iteration).

**Step 7: Verify the file compiles**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: No TypeScript errors. If `MAP_PIN_RASTER_SIZE` or `browsePinIconSizeAtZoom` are still referenced (by leftover code), remove those usages or keep the imports.

**Step 8: Run all frontend tests**

```bash
cd frontend && npm run test
```

Expected: All tests pass.

**Step 9: Manual verification**

Start the dev environment:
```bash
make dev-infra
make dev-backend   # separate terminal
make dev-frontend  # separate terminal
```

Open http://localhost:5173/browse and confirm:
1. Photos appear as white rectangular callout bubbles on the map
2. The triangle pointer is at the bottom, pointing at the photo's GPS coordinate
3. Empty white boxes show first, then images load in
4. Clicking a callout opens the lightbox as before
5. At least two photos with different aspect ratios (portrait vs landscape) show correctly — images are not cropped or distorted
6. Zooming / panning updates visible pins (bbox refetch still works)
