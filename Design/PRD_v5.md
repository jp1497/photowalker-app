# Photowalker Product Requirements Document — Map Basemap Styling (v5)

**Version:** 5.0  
**Date:** 2026-02-17  
**Status:** Specification  
**Previous Version:** [PRD v4](./PRD_v4.md) (Map-First Frontend Overhaul)  
**Scope:** Frontend map basemap styling only; assumes v4 layout. Backend unchanged.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Objectives and Success Criteria](#objectives-and-success-criteria)
3. [Current State (Post–v4)](#current-state-post-v4)
4. [Target Design: Basemap Style](#target-design-basemap-style)
5. [Requirements](#requirements)
6. [Impact Surface](#impact-surface)
7. [Out of Scope](#out-of-scope)
8. [Appendix: Style URL vs Programmatic](#appendix-style-url-vs-programmatic)
9. [Appendix: Prettymaps-Like Flavor](#appendix-prettymaps-like-flavor)
10. [References](#references)

---

## Executive Summary

This PRD defines **map basemap styling** for Photowalker (v5). It builds on the map-first frontend (v4): the map already fills the viewport and overlays provide browse, route detail, and create flows. v5 replaces the current OSM raster base with a **vector basemap** (Protomaps light) and customizes its colors to achieve **prettymaps-like visual interest**—warm background, distinct water and green, clear streets—using a **programmatic** MapLibre style and a custom **Flavor** object. No Python or server-side style service; all styling is MapLibre-native in the frontend.

**Design principle:** One vector basemap, one custom Flavor; app layers (routes, clusters, markers) remain on top.

**Relationship to v4:** PRD v4 covers layout (full-viewport map shell, overlays). This v5 PRD is limited to the basemap’s look: source, style construction, and color customization. It does not change backend, v4 layout, or v3 feature set.

---

## Objectives and Success Criteria

1. **Vector basemap** — The map uses a vector tile basemap (Protomaps) instead of the current OSM raster tiles.
2. **Consistent light style** — The base style matches the Protomaps “light” theme (buildings, roads, water, labels) with correct glyphs and sprites.
3. **Prettymaps-like palette** — Colors are customized via a single Flavor object: warm background, water, parks, streets, and buildings tuned to evoke the prettymaps aesthetic (cream, soft blues/greens, dark-but-not-black roads).
4. **App layers on top** — Existing GeoJSON layers (routes, clusters, photo markers) continue to render above the basemap without regression.
5. **No new backend** — Style is built in the frontend; optional Protomaps API key is the only external dependency for tiles.

---

## Current State (Post–v4)

- **Layout:** Per v4, the map fills the viewport; MapShell owns a single MapView; overlays provide browse, route detail, create, and auth.
- **Basemap:** MapView uses an inline MapLibre style (version 8) with a single **raster** source (`tile.openstreetmap.org`) and one raster layer. No vector layers, no labels from the base style.
- **App layers:** Browse, RouteView, and CreateRouteFromPhotos add GeoJSON sources and layers (clusters, symbols, lines) via `onMapReady`; they are appended on top of the base layer(s).
- **Stack:** React 19, Vite 7, maplibre-gl 4.7, zustand. No `@protomaps/basemaps` or Protomaps API key today.

---

## Target Design: Basemap Style

### Approach: Programmatic Style + Custom Flavor

- **Source:** Protomaps Tile API (TileJSON URL) as a single vector source. Requires an API key (free for non-commercial use; [protomaps.com/account](https://protomaps.com/account)).
- **Style construction:** Build the MapLibre style object in code using `@protomaps/basemaps`: one vector source, glyphs and sprite URLs from Protomaps basemaps-assets, and layers from `layers("protomaps", flavor, { lang: "en" })`.
- **Flavor:** Use a **custom Flavor** that spreads `namedFlavor("light")` and overrides color keys (background, water, buildings, park_a/park_b, highway/major/minor, etc.) to approximate the prettymaps default preset. This gives a single place to tune the map’s look without editing remote JSON or mutating the style after load.
- **MapView:** Pass the built style object into `new maplibregl.Map({ container, style, center, zoom })`. Existing `map.on('load', ...)` and `onMapReady` behavior unchanged; style is synchronous.

### Why Programmatic (Not Style URL)

- **Customization:** A prettymaps-like palette requires overriding many color keys. The Protomaps style URL returns a fixed JSON; customizing it would require fetching and mutating layer `paint` properties, which is fragile when Protomaps update their style.
- **Performance:** Comparable. Style URL adds one HTTP request for the style document; programmatic adds one dependency and in-memory style build. Tile loading is identical. Programmatic can be marginally better first-paint by avoiding the style fetch.
- **Complexity:** Bounded to one style-builder module and one Flavor module. No ongoing style surgery.

See [Appendix: Style URL vs Programmatic](#appendix-style-url-vs-programmatic) for the full tradeoff analysis.

### Layer Order

- The programmatic style’s `layers(...)` output ends with symbol/label layers. When pages call `map.addLayer()` without a second argument (current behavior), MapLibre appends layers on top, so route lines, clusters, and photo markers render above the basemap.
- If a specific insert position is ever needed (e.g. app layers below a future overlay), introduce a well-known `beforeId` and use `map.addLayer(layer, beforeId)` consistently; document that id in one place.

---

## Requirements

### FR-M5: Protomaps Vector Basemap

**User Story:** As a user, I see a detailed vector basemap (roads, buildings, water, labels) instead of the current raster tiles.

**Acceptance Criteria:**

- The map uses a single vector source backed by the Protomaps Tile API (TileJSON URL). API key is provided via environment (e.g. `VITE_PROTOMAPS_API_KEY`).
- The base style includes layers for background, water, landcover, roads, buildings, and labels; glyphs and sprite reference Protomaps basemaps-assets URLs.
- Attribution includes Protomaps and OpenStreetMap as required by the API and ODbL.

### FR-M6: Prettymaps-Like Color Palette

**User Story:** As a user, the map has a warm, distinctive look similar to prettymaps (cream background, soft water and green, clear streets).

**Acceptance Criteria:**

- A custom Flavor object overrides at least: background/earth (cream), water, buildings, park_a/park_b, wood_a/wood_b, beach/sand, and road/casing colors (streets dark with lighter casing).
- The Flavor is defined in one place (e.g. `protomapsFlavor.ts`) and passed into the style builder so colors can be tuned without changing layer structure.
- Hex values align with the prettymaps default preset where applicable (see [Appendix: Prettymaps-Like Flavor](#appendix-prettymaps-like-flavor)).

### FR-M7: App Layers Unchanged

**User Story:** As a developer, existing map features (browse clusters, route polyline, photo pins, create preview) still work and render above the basemap.

**Acceptance Criteria:**

- Browse, RouteView, and CreateRouteFromPhotos continue to add sources and layers in `onMapReady`. No change to layer semantics or ordering unless a documented `beforeId` is introduced.
- `onMapReady` is invoked only after the style (and its sources) are loaded so `addSource`/`addLayer` are valid.

### FR-M8: Style Build and MapView Integration

**User Story:** As a developer, the basemap style is built in one module and consumed by MapView without async style loading.

**Acceptance Criteria:**

- A style-builder (e.g. `frontend/src/map/protomapsStyle.ts`) exports a function that returns the MapLibre style object (version 8) given the API key (or reads it from env). It uses `@protomaps/basemaps` for `layers(sourceName, flavor, { lang: "en" })` and the same glyphs/sprite as in Protomaps docs.
- MapView uses this style as the `style` option of `new maplibregl.Map(...)`. No style URL fetch; no `setStyle` after load unless required for a future feature.

---

## Impact Surface

### New or Modified Files

- **frontend/src/map/protomapsStyle.ts** (new) — Builds the MapLibre style: vector source (TileJSON URL + key), glyphs, sprite, `layers("protomaps", flavor, { lang: "en" })`. Exports a function that returns the style object.
- **frontend/src/map/protomapsFlavor.ts** (new) — Exports the custom Flavor (e.g. `prettyMapsLikeFlavor`) that spreads `namedFlavor("light")` and overrides color keys. Used by the style builder.
- **frontend/src/components/map/MapView.tsx** — Replace the current inline raster style with the style returned by the style builder. No change to `onMapReady` or center/zoom handling.

### Dependencies and Environment

- **npm:** Add `@protomaps/basemaps`. No `pmtiles` required when using the Protomaps Tile API (TileJSON).
- **Environment:** Add `VITE_PROTOMAPS_API_KEY` to `.env` and `.env.example` (placeholder). Document in README that the key is required for the map and is free for non-commercial use ([protomaps.com/api](https://protomaps.com/api)).

### Tests and Documentation

- **Tests:** Update any tests that assume the current style (e.g. a single raster source or layer). Mocks for MapView/MapPicker remain; ensure tests that inspect map style or layer count are updated.
- **Docs:** Document use of Protomaps, API key, and that the style is built programmatically with a custom Flavor for prettymaps-like colors. Attribution and usage policy (non-commercial free) noted.

### Risks and Mitigations

- **API key exposure:** Key is build-time only (`VITE_*`); do not ship secret keys in public repos. Use env.example with a placeholder.
- **Protomaps API changes:** TileJSON URL and style package version are pinned in code; if Protomaps change their API or layer schema, the style builder and Flavor may need updates. Prefer a single place (style builder + Flavor) so changes are localized.

---

## Out of Scope

- Backend API changes or a server-side style/tile service.
- Prettymaps Python library or any server-rendered map imagery.
- MapLibre custom style layers (WebGL overlays) unless needed for a future feature.
- Changing v4 layout, overlay behavior, or v3 feature set.
- Adding a layer switcher or multiple basemap themes in this PRD; a single prettymaps-like theme is sufficient for v5.

---

## Appendix: Style URL vs Programmatic

### Style URL

- Set the map’s `style` to `https://api.protomaps.com/styles/v5/light/en.json?key=...`. MapLibre fetches that JSON once, then loads tiles from the source(s) in the style.
- **Performance:** One extra HTTP request for the style document. Tile loading identical to programmatic.
- **Complexity:** Lowest: one env var and one string; no new dependencies.
- **Customization:** Would require fetching the style and mutating layer `paint` properties; fragile when Protomaps change layer ids or structure.

### Programmatic (`@protomaps/basemaps`)

- Build the style object in code (sources + `layers(sourceName, flavor, { lang: "en" })` + glyphs + sprite); pass it to `new maplibregl.Map({ style })`.
- **Performance:** No style URL fetch; one dependency; style built in memory at init. Tile loading identical. Comparable or marginally better first-paint.
- **Complexity:** One dependency, style-builder module, Flavor module. Complexity localized.
- **Customization:** First-class via Flavor overrides in one place.

**Recommendation (v5):** Programmatic, so that a prettymaps-like palette is straightforward and maintainable. If customization is dropped later, the app could switch to the style URL and remove the basemaps dependency.

---

## Appendix: Prettymaps-Like Flavor

The [Flavor interface](https://maps.protomaps.com/typedoc/interfaces/Flavor.html) is a single object of color strings. Spread `namedFlavor("light")` and override the keys below to approximate the prettymaps default preset.

| Element       | Example hex   | Flavor keys |
|---------------|---------------|-------------|
| Background    | `#F2F4CB`     | `background`, `earth` |
| Buildings     | `#7B534E` (or `#433633`) | `buildings` |
| Water         | `#a8e1e6`     | `water` |
| Parks         | `#8BB174`, `#D0F1BF` | `park_a`, `park_b` |
| Forest/wood   | `#64B96A`     | `wood_a`, `wood_b` |
| Streets       | `#2F3737`, casing `#475657` | `highway`, `major`, `minor_a`, `minor_b`, `highway_casing_*`, `major_casing_*`, `minor_casing`, `link`, `link_casing`, `pedestrian`, `other` |
| Beach/sand    | `#FCE19C`     | `beach`, `sand` |

Example (use in `protomapsFlavor.ts` and pass to `layers("protomaps", prettyMapsLikeFlavor, { lang: "en" })`):

```ts
const prettyMapsLikeFlavor = {
  ...namedFlavor('light'),
  background: '#F2F4CB',
  earth: '#F2F4CB',
  buildings: '#7B534E',
  water: '#a8e1e6',
  park_a: '#8BB174',
  park_b: '#D0F1BF',
  wood_a: '#64B96A',
  wood_b: '#8BB174',
  beach: '#FCE19C',
  sand: '#FCE19C',
  highway: '#2F3737',
  highway_casing_early: '#475657',
  highway_casing_late: '#475657',
  major: '#2F3737',
  major_casing_early: '#475657',
  major_casing_late: '#475657',
  minor_a: '#2F3737',
  minor_b: '#2F3737',
  minor_casing: '#475657',
  link: '#2F3737',
  link_casing: '#475657',
  pedestrian: '#2F3737',
  other: '#2F3737',
};
```

The Flavor API supports one color per layer type; building palettes (multiple colors per building) are not supported, so a single building fill is used.

---

## References

- [Protomaps Hosted API](https://protomaps.com/api) — TileJSON, style URL, API key, usage policy (non-commercial free).
- [Basemaps for MapLibre](https://docs.protomaps.com/basemaps/maplibre) — assets (glyphs, sprites), programmatic style with `@protomaps/basemaps`.
- [Basemap Flavors](https://docs.protomaps.com/basemaps/flavors) — Flavor object, overriding defaults.
- [Flavor interface (TypeScript)](https://maps.protomaps.com/typedoc/interfaces/Flavor.html) — all color keys.
- [MapLibre Style Spec](https://github.com/maplibre/maplibre-style-spec) — style JSON reference.

---

**Document Status:** Specification  
**Next Steps:** Approve PRD v5; implement per a v5 implementation roadmap (style builder, Flavor, MapView integration, tests, docs).
