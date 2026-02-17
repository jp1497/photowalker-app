# Photowalker Implementation Roadmap v5 — Map Basemap Styling

**Version:** 1.0  
**Date:** 2026-02-17  
**Design Reference:** [PRD v5 — Map Basemap Styling](./PRD_v5.md)  
**Prerequisite:** v4 map-first frontend (per [PRD v4](./PRD_v4.md) / [IMPLEMENTATION_ROADMAP_V4](./IMPLEMENTATION_ROADMAP_V4.md)) is in place. v5 is frontend map styling only.

---

## Overview

This roadmap defines the phased implementation of the map basemap styling (PRD v5). The map base switches from OSM raster tiles to a **Protomaps vector basemap** with a **programmatic** MapLibre style and a **custom Flavor** for prettymaps-like colors. Each phase has discrete steps with Agent Instructions, Design Constraints, and Definition of Done.

**Scope:** Frontend only. Backend and API unchanged. No new backend style or tile service.

---

## Design Authority

**Primary Reference:** [Design/PRD_v5.md](./PRD_v5.md) (Map Basemap Styling)

**Agent Rule:** Implement exactly what is specified in the PRD. Do NOT:
- Add a style URL approach or PMTiles unless the PRD is updated
- Change v4 layout, overlays, or app layer behavior
- Introduce backend endpoints for style or tiles
- Add a layer switcher or multiple basemap themes (out of scope for v5)

**Permission to Deviate:** If a technical constraint requires a design change (e.g. Protomaps API or package breaking change), document the proposed change and stop. Do not implement alternatives without approval.

---

## Phase Overview

| Phase | Name | Steps | Est. Commits |
|-------|------|-------|--------------|
| 1 | Dependencies and Environment | 2 | 2 |
| 2 | Style Builder and Flavor | 2 | 2 |
| 3 | MapView Integration | 1 | 1 |
| 4 | Tests and Documentation | 2 | 2 |
| **Total** | | **7** | **7** |

---

## Phase 1: Dependencies and Environment

**Goal:** Add the Protomaps basemaps package and the API key environment variable so the style builder can run and the map can load tiles.

**Design Reference:** [PRD v5 - FR-M5](./PRD_v5.md#fr-m5-protomaps-vector-basemap), [Impact Surface - Dependencies and Environment](./PRD_v5.md#dependencies-and-environment)

---

### Step 1.1: Install @protomaps/basemaps

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `chore(frontend): add @protomaps/basemaps for programmatic map style`

#### Agent Instructions

1. In `frontend/`, run `npm install @protomaps/basemaps` and commit the resulting `package.json` and `package-lock.json` changes.
2. Do **not** add `pmtiles`; the Protomaps Tile API (TileJSON) is used, not PMTiles.
3. Verify the project still builds (`npm run build`) and tests run (`npm run test`).

#### Design Constraints

- [PRD v5 - Approach: Programmatic](./PRD_v5.md#approach-programmatic-style--custom-flavor)
- Single new dependency; no removal of existing map dependencies (maplibre-gl remains).

#### Unit Tests

- No new tests required for this step. Existing tests must still pass.

#### Definition of Done

- [ ] `@protomaps/basemaps` is listed in `frontend/package.json` dependencies.
- [ ] `npm run build` and `npm run test` succeed.

---

### Step 1.2: Add Protomaps API Key to Environment

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `chore(frontend): add VITE_PROTOMAPS_API_KEY for Protomaps Tile API`

#### Agent Instructions

1. Add `VITE_PROTOMAPS_API_KEY` to `frontend/.env.example` with a placeholder value (e.g. `your_protomaps_api_key_here` or empty string). Include a one-line comment that the key is required for the map and is free for non-commercial use (see protomaps.com/api).
2. If the project uses a root `.env.example`, add the same key and comment there if frontend reads env from root.
3. Do **not** commit a real API key. Ensure `.env` is in `.gitignore` if it exists (or document that users must create `.env` from `.env.example` and add their key).
4. Document in a single sentence in `frontend/README.md` or the project README (if frontend is the main app): "The map uses the Protomaps Tile API; set `VITE_PROTOMAPS_API_KEY` in `.env` (get a key at protomaps.com/account, free for non-commercial use)." If there is no README section for env vars, add a short "Environment" or "Setup" subsection.

#### Design Constraints

- [PRD v5 - Impact Surface - Environment](./PRD_v5.md#dependencies-and-environment)
- Key is build-time only (`VITE_*`); do not ship secret keys in repo.

#### Unit Tests

- N/A for env file changes.

#### Definition of Done

- [ ] `VITE_PROTOMAPS_API_KEY` is present in `.env.example` (and root if applicable) with placeholder and brief comment.
- [ ] README (or equivalent) states that the key is required for the map and where to obtain it.
- [ ] No real API key committed.

---

## Phase 2: Style Builder and Flavor

**Goal:** Create the programmatic style builder and the custom Flavor so MapView can consume a single style object (vector source, layers, glyphs, sprite) with prettymaps-like colors.

**Design Reference:** [PRD v5 - FR-M5](./PRD_v5.md#fr-m5-protomaps-vector-basemap), [FR-M6](./PRD_v5.md#fr-m6-prettymaps-like-color-palette), [FR-M8](./PRD_v5.md#fr-m8-style-build-and-mapview-integration), [Appendix: Prettymaps-Like Flavor](./PRD_v5.md#appendix-prettymaps-like-flavor)

---

### Step 2.1: Create Custom Flavor Module

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `feat(frontend): add prettymaps-like Protomaps Flavor`

#### Agent Instructions

1. Create `frontend/src/map/protomapsFlavor.ts` (create the directory `frontend/src/map/` if it does not exist).
2. Import `namedFlavor` from `@protomaps/basemaps`.
3. Define and export a Flavor object (e.g. `prettyMapsLikeFlavor`) that:
   - Spreads `namedFlavor('light')`.
   - Overrides at least: `background`, `earth`, `buildings`, `water`, `park_a`, `park_b`, `wood_a`, `wood_b`, `beach`, `sand`, and all road/casing keys used in the PRD appendix (`highway`, `highway_casing_early`, `highway_casing_late`, `major`, `major_casing_early`, `major_casing_late`, `minor_a`, `minor_b`, `minor_casing`, `link`, `link_casing`, `pedestrian`, `other`).
   - Uses the hex values from [PRD v5 - Appendix: Prettymaps-Like Flavor](./PRD_v5.md#appendix-prettymaps-like-flavor) (e.g. background `#F2F4CB`, water `#a8e1e6`, buildings `#7B534E`, streets `#2F3737` / casing `#475657`, etc.).
4. Use TypeScript types from `@protomaps/basemaps` for the Flavor if available; otherwise ensure the object shape matches the Flavor interface (all required color keys present via spread + overrides).

#### Design Constraints

- [PRD v5 - FR-M6](./PRD_v5.md#fr-m6-prettymaps-like-color-palette)
- Single place for color tuning; no hardcoded colors in the style builder for basemap layers.

#### Unit Tests

- Optional: shallow test that `prettyMapsLikeFlavor` has expected keys (e.g. `background`, `water`) and values (e.g. `#F2F4CB`, `#a8e1e6`). Not required if time-constrained.

#### Definition of Done

- [ ] `frontend/src/map/protomapsFlavor.ts` exists and exports a Flavor used for basemap layers.
- [ ] Flavor spreads `namedFlavor('light')` and overrides background, water, buildings, parks, woods, beach/sand, and road/casing colors per PRD appendix.
- [ ] Project builds and lint passes.

---

### Step 2.2: Create Style Builder Module

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `feat(frontend): add Protomaps programmatic style builder`

#### Agent Instructions

1. Create `frontend/src/map/protomapsStyle.ts`.
2. Import `layers` from `@protomaps/basemaps` and the custom Flavor from `./protomapsFlavor` (or the path used in Step 2.1).
3. Define a function (e.g. `getProtomapsStyle(apiKey: string)` or `getProtomapsStyle()` that reads `import.meta.env.VITE_PROTOMAPS_API_KEY`) that returns a MapLibre style object (version 8) with:
   - **sources:** One vector source with `type: "vector"`, `url: "https://api.protomaps.com/tiles/v4.json?key=" + apiKey`, and `attribution` including Protomaps and OpenStreetMap (per [Protomaps API](https://protomaps.com/api) and ODbL).
   - **glyphs:** `https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf`
   - **sprite:** `https://protomaps.github.io/basemaps-assets/sprites/v4/light`
   - **layers:** `layers("protomaps", prettyMapsLikeFlavor, { lang: "en" })` (or equivalent with the exported Flavor and source name `"protomaps"`).
4. Export the function. If the function takes no arguments, it must read the API key from `import.meta.env.VITE_PROTOMAPS_API_KEY` and handle missing key (e.g. return a fallback style or throw a clear error so the app does not load invalid tiles).
5. Ensure the style object is valid for MapLibre (version 8, required fields present). Do not add app-specific layers (routes, clusters); those are added by existing code in `onMapReady`.

#### Design Constraints

- [PRD v5 - FR-M5](./PRD_v5.md#fr-m5-protomaps-vector-basemap), [FR-M8](./PRD_v5.md#fr-m8-style-build-and-mapview-integration)
- [Basemaps for MapLibre](https://docs.protomaps.com/basemaps/maplibre) — same glyphs and sprite URLs as docs.
- Source name must be `"protomaps"` (or the same string passed to `layers()` as the first argument).

#### Unit Tests

- Optional: unit test that `getProtomapsStyle` returns an object with `version: 8`, `sources`, `layers`, `glyphs`, `sprite`. Not required if time-constrained.

#### Definition of Done

- [ ] `frontend/src/map/protomapsStyle.ts` exists and exports a function that returns a complete MapLibre style object.
- [ ] Style includes one vector source (Protomaps TileJSON URL with key), glyphs, sprite, and layers from `layers("protomaps", flavor, { lang: "en" })`.
- [ ] Attribution includes Protomaps and OpenStreetMap.
- [ ] Project builds and lint passes.

---

## Phase 3: MapView Integration

**Goal:** MapView uses the programmatic style instead of the current inline raster style. App layers (Browse, RouteView, CreateRouteFromPhotos) continue to be added in `onMapReady` and render on top.

**Design Reference:** [PRD v5 - FR-M7](./PRD_v5.md#fr-m7-app-layers-unchanged), [FR-M8](./PRD_v5.md#fr-m8-style-build-and-mapview-integration), [Target Design - Layer Order](./PRD_v5.md#layer-order)

---

### Step 3.1: Switch MapView to Protomaps Style

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `feat(frontend): use Protomaps programmatic style in MapView`

#### Agent Instructions

1. In `frontend/src/components/map/MapView.tsx`:
   - Import the style builder (e.g. `getProtomapsStyle` from `../../map/protomapsStyle` or the correct relative path).
   - Replace the current inline `style` object (raster source + single raster layer) with the result of calling the style builder. Pass the API key from `import.meta.env.VITE_PROTOMAPS_API_KEY` if the builder accepts it; otherwise the builder reads it internally.
   - Do **not** change the rest of MapView: `center`, `zoom`, `onMapReady`, `map.on('load', ...)`, refs, or cleanup. The style is synchronous so `onMapReady` continues to run after the map's `load` event.
2. If the API key is missing at runtime, decide on behavior: (a) show a minimal fallback style (e.g. a blank or OSM raster style) with a console warning, or (b) throw so the app fails fast. Prefer (a) with a clear warning so the app still loads in dev without a key initially; document that the map will not show vector tiles until the key is set.
3. Verify that existing pages that use the map (Browse, RouteDetail, CreateRouteFromPhotos, RouteView) still receive `onMapReady` and can add sources and layers. No change to `addLayer` calls in those files unless a `beforeId` is explicitly introduced (not required for v5; default append order keeps app layers on top).

#### Design Constraints

- [PRD v5 - FR-M7](./PRD_v5.md#fr-m7-app-layers-unchanged)
- [PRD v5 - Impact Surface - MapView](./PRD_v5.md#new-or-modified-files)
- Map + control teardown doctrine unchanged; single owner, try/catch cleanup.

#### Unit Tests

- Existing MapView and map-using page tests must still pass. If any test asserts on the map's style (e.g. source or layer count), update the test to expect the new style (vector source, multiple layers from Protomaps).

#### Definition of Done

- [ ] MapView uses the style from the style builder instead of the inline raster style.
- [ ] Map loads without error when `VITE_PROTOMAPS_API_KEY` is set; graceful behavior when key is missing (fallback or warning).
- [ ] `onMapReady` still fires; Browse, RouteView, CreateRouteFromPhotos add their layers and display correctly (manual smoke check or existing tests pass).
- [ ] No change to MapView props, refs, or cleanup logic beyond the `style` option.

---

## Phase 4: Tests and Documentation

**Goal:** Update tests that depend on the old raster style and document Protomaps usage, API key, and attribution.

**Design Reference:** [PRD v5 - Impact Surface - Tests and Documentation](./PRD_v5.md#tests-and-documentation)

---

### Step 4.1: Update Map-Related Tests

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `test(frontend): update tests for Protomaps basemap style`

#### Agent Instructions

1. Run the full frontend test suite (`npm run test` or `vitest run`). Identify any test that fails due to the style change (e.g. mocks that expect a raster source or a single layer; assertions on style object shape).
2. Update mocks: if a test mocks `maplibregl.Map` or the map's `getSource`/`getLayer`/`addLayer` and the test was written for the previous style, adjust the mock so it does not assume "osm-tiles" or "osm-layer", or update assertions to the new style (e.g. source id "protomaps", multiple layers).
3. Do not remove tests that are still valid; only update expectations and mocks. Preserve MapView and MapPicker mocks where they are used to isolate page behavior.
4. Ensure lint passes (`npm run lint`).

#### Design Constraints

- [PRD v5 - Impact Surface - Tests](./PRD_v5.md#tests-and-documentation)
- Definition of Done as scope boundary; do not add unrelated tests.

#### Definition of Done

- [ ] All existing frontend tests pass.
- [ ] No unnecessary removal of tests; only updates for new style/source/layer expectations.
- [ ] Lint passes.

---

### Step 4.2: Document Protomaps and API Key

**Branch:** `feat/v5-map-basemap-style`  
**Commit Message:** `docs: document Protomaps basemap and API key for map`

#### Agent Instructions

1. Add or update documentation (README in frontend or project root, or a short Design/ or docs/ note) to cover:
   - The map uses the **Protomaps** vector basemap (Tile API). Style is built programmatically with `@protomaps/basemaps` and a custom Flavor for prettymaps-like colors.
   - **API key:** Set `VITE_PROTOMAPS_API_KEY` in `.env` (see `.env.example`). Get a key at [protomaps.com/account](https://protomaps.com/account). The API is free for non-commercial use; see [protomaps.com/api](https://protomaps.com/api) for usage policy.
   - **Attribution:** The map style and tiles require attribution to Protomaps and OpenStreetMap; the style builder includes this in the source attribution.
2. If there is an existing "Environment" or "Setup" section, add the API key there; otherwise add a minimal "Map / Protomaps" or "Environment variables" subsection.
3. Do not duplicate lengthy text; keep it to a few sentences. Reference the PRD v5 or this roadmap for implementation details if needed.

#### Design Constraints

- [PRD v5 - Impact Surface - Docs](./PRD_v5.md#tests-and-documentation)

#### Definition of Done

- [ ] README (or equivalent) states that the map uses Protomaps, that `VITE_PROTOMAPS_API_KEY` is required, where to get the key, and that non-commercial use is free.
- [ ] Attribution (Protomaps + OSM) is mentioned where relevant (e.g. in the same subsection).

---

## UAT Master Checklist (Map Basemap Styling)

| ID | Requirement | Verification |
|----|-------------|--------------|
| UAT-S1 | Vector basemap visible | Manual: map shows roads, buildings, water, labels (not raster tiles). |
| UAT-S2 | Prettymaps-like colors | Manual: cream background, soft water/green, dark streets; distinct from default Protomaps light. |
| UAT-S3 | Browse: route clusters and pins on top | Browse map; clusters and pins visible above basemap; click navigates to route. |
| UAT-S4 | Route detail: polyline and photo pins on top | Open a route; polyline and photo markers visible above basemap. |
| UAT-S5 | Create route: preview line and markers on top | Create flow; preview line and photo markers visible above basemap. |
| UAT-S6 | Map loads without key (graceful) | With no `VITE_PROTOMAPS_API_KEY`: app loads; map shows fallback or warning (no crash). |
| UAT-S7 | Map loads with key | With valid key: tiles load; no console errors; attribution visible if required by UI. |

---

## Git Workflow

- **Branch:** `feat/v5-map-basemap-style` (single branch for v5) or one branch per phase (e.g. `feat/v5-basemap-phase-1`).
- **Commits:** One commit per step; message format `type(scope): description` (e.g. `feat(frontend): add Protomaps programmatic style builder`).
- **PR:** Merge after all phases complete and tests pass, or merge by phase if preferred.

---

## Agent Quick Reference

1. **Read** PRD v5 (Map Basemap Styling) and the step's Agent Instructions.
2. **Implement** style builder, Flavor, and MapView integration as specified; do not add style URL path or layer switcher.
3. **Preserve** v4 layout and overlay behavior; app layers (routes, clusters, markers) unchanged in semantics and order.
4. **Update tests** only for new style/source/layer expectations; keep mocks where appropriate.
5. **Verify** Definition of Done before committing.

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-17
