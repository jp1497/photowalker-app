# Photowalker Implementation Roadmap v4 — Map-First Frontend Overhaul

**Version:** 1.0  
**Date:** 2026-02-15  
**Design Reference:** [PRD v4 — Map-First Frontend Overhaul](./PRD_v4.md)  
**Prerequisite:** v3 features (per [PRD v3](./PRD_v3.md) / [IMPLEMENTATION_ROADMAP_V3](./IMPLEMENTATION_ROADMAP_V3.md)) may be in progress or complete; v4 is frontend layout only.

---

## Overview

This roadmap defines the phased implementation of the map-first frontend overhaul (PRD v4). The map fills the viewport; all other UI is minimal popups (drawers, panels, modals). Each phase has discrete steps with Agent Instructions, Design Constraints, and Definition of Done.

**Scope:** Frontend only. Backend and API unchanged.

---

## Design Authority

**Primary Reference:** [Design/PRD_v4.md](./PRD_v4.md) (Map-First Frontend Overhaul)

**Agent Rule:** Implement exactly what is specified in the PRD. Do NOT:
- Add features or overlays not in the PRD
- Change backend, API, or data contracts
- Introduce new dependencies without justification

**Permission to Deviate:** If a technical constraint requires a design change, document the proposed change and stop. Do not implement alternatives without approval.

---

## Phase Overview

| Phase | Name | Steps | Est. Commits |
|-------|------|-------|--------------|
| 1 | Layout Foundation | 3 | 3 |
| 2 | Browse Map-First | 2 | 2 |
| 3 | Route Detail Map-First | 2 | 2 |
| 4 | My Routes Overlay | 1 | 1 |
| 5 | Create Flow Overlay | 2 | 2 |
| 6 | Home and Login | 1 | 1 |
| 7 | Polish and Tests | 2 | 2 |
| **Total** | | **13** | **13** |

---

## Phase 1: Layout Foundation

**Goal:** Full-viewport map shell, minimal nav, CSS that allows map to fill viewport.

**Design Reference:** [PRD v4 - FR-M1](./PRD_v4.md#fr-m1-full-viewport-map-shell), [FR-M2](./PRD_v4.md#fr-m2-minimal-chrome-and-overlays)

---

### Step 1.1: CSS and Root Layout for Full-Viewport Map

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): allow full-viewport map shell via root and body CSS`

#### Agent Instructions

1. Update `frontend/src/index.css`:
   - Remove or adjust `place-items: center` on `body` so a full-viewport map container can fill the screen.
   - Ensure `body` and `html` allow height 100% (e.g. `height: 100%` where needed).
2. Update `frontend/src/App.css`:
   - Remove or scope `#root` max-width and padding for the map shell. When the map is shown, `#root` (or a map-shell wrapper inside it) can be `width: 100vw; height: 100vh` without being constrained by max-width.
   - Retain or relocate any non-map styles (e.g. for loading or non-map pages) so they do not break.
3. Ensure no global style prevents a child div from filling the viewport.

#### Design Constraints

- [PRD v4 - Impact Surface - index.css, App.css](./PRD_v4.md#impact-surface)

#### Unit Tests

- N/A (layout); manual or E2E check that a full-viewport div can render at 100vw×100vh.

#### Definition of Done

- [ ] Map shell container can occupy full viewport without being constrained by #root max-width or body centering.
- [ ] Existing non-map pages (e.g. Login if standalone) still render correctly.

---

### Step 1.2: Map Shell Component

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): add MapShell component (full viewport, single MapView)`

#### Agent Instructions

1. Create a new component (e.g. `frontend/src/components/map/MapShell.tsx` or `frontend/src/layouts/MapShell.tsx`):
   - Renders a single full-viewport div (100vw×100vh or 100% of parent that is sized to viewport).
   - Renders a single `MapView` inside it (one MapLibre instance).
   - Accepts props or context for "mode" (browse | detail | create) and optional `slug` for route detail.
   - Does not yet add layers; that comes in later steps. For this step, the shell only provides the container and the single MapView; optionally call `onMapReady` for parent to attach layers later.
2. MapShell owns the MapView lifecycle (mount/teardown). Follow existing map teardown doctrine: single owner, try/catch on control cleanup.
3. Use `usePreferredMapCenter` for initial center/zoom when no route is selected.

#### Design Constraints

- [PRD v4 - FR-M1](./PRD_v4.md#fr-m1-full-viewport-map-shell)
- [PRD v4 - New: Map shell component](./PRD_v4.md#impact-surface)

#### Unit Tests

- MapShell renders a container that wraps MapView.
- MapShell passes through or uses initial center/zoom (e.g. from usePreferredMapCenter).

#### Definition of Done

- [ ] MapShell component exists and renders one MapView full viewport.
- [ ] No duplicate MapView instances when switching routes (shell is the single owner).

---

### Step 1.3: App Layout — Minimal Nav and Map Shell for Map Routes

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): replace top nav with minimal menu, wrap map routes in MapShell`

#### Agent Instructions

1. Update `frontend/src/App.tsx`:
   - Remove the full-width top `<nav>` bar.
   - Add a minimal entry point for navigation: e.g. hamburger button or FAB (floating action button) in a corner (e.g. top-left or top-right). Clicking it opens a **menu popup** (dropdown or overlay) with: Home, Browse, My routes, Create route, Sign in / Sign out (and user name when authenticated).
   - For routes that show the map (`/`, `/browse`, `/routes/me`, `/routes/create`, `/routes/:slug`), render `MapShell` as the main layout so the map fills the viewport. Route-specific content (e.g. which overlay to show) is handled by the route component rendered inside or alongside the shell (see next phases).
   - For `/login` and `/auth/callback`, keep current behavior (no map shell; full page or overlay as today).
   - Ensure `Toast` and any global error boundary remain.
2. Implement a simple **menu popup** component (e.g. `MenuOverlay` or `AppMenu`): list of links and Sign out; close on link click or outside click. No design system required; inline styles or minimal CSS acceptable.
3. Ensure keyboard and screen reader: menu can be opened (e.g. Enter/Space on button), closed (Escape), and links are focusable.

#### Design Constraints

- [PRD v4 - FR-M2](./PRD_v4.md#fr-m2-minimal-chrome-and-overlays) — nav via minimal entry, menu popup.

#### Unit Tests

- App renders without full-width nav when map routes are active.
- Menu opens and contains expected links (Browse, etc.); closing and navigation can be tested (e.g. click Browse, route changes).

#### Definition of Done

- [ ] Top nav removed; minimal menu (FAB or hamburger) opens popup with Home, Browse, My routes, Create route, Sign in/out.
- [ ] Map routes render inside MapShell (map fills viewport); login/callback do not use MapShell.
- [ ] No regression: user can navigate to Browse, My routes, Create, Route detail, Login.

---

## Phase 2: Browse Map-First

**Goal:** Browse page uses MapShell; map fills viewport; filters and list moved into overlays.

**Design Reference:** [PRD v4 - Overlay inventory - Browse](./PRD_v4.md#overlay-inventory-target)

---

### Step 2.1: Browse — Map Full Viewport, Filters in Overlay

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): browse map full viewport, tags filter in overlay`

#### Agent Instructions

1. Refactor `frontend/src/pages/Browse.tsx`:
   - Use MapShell (or render map full viewport within the route) so the map is the only main content; remove the top bar that sits above the map.
   - Add a small **floating control** (e.g. "Filters" or filter icon) that opens an **overlay** (panel or drawer). Inside the overlay: tags input and "Apply" (reuse current tags logic). Closing the overlay applies or retains current filter; bbox fetch still runs when map moves.
   - Map/List toggle: either (a) "List" opens a separate overlay (drawer/panel) that shows RouteList, or (b) keep Map as default and "List" opens overlay with RouteList. Ensure list still receives routes (from bbox when on map, or from paginated list when list view was last used) and pagination works.
   - Preserve existing behavior: bbox-based fetch, clustering, click pin → navigate to `/routes/:slug`, tags filter, loading and "zoom in" overlay messages. Use MapPanel only for the small overlay message (e.g. "Loading routes…", "Zoom in to see routes") if needed.
2. Ensure URL remains `/browse`; no change to route path.

#### Design Constraints

- [PRD v4 - FR-M2, FR-M4](./PRD_v4.md#fr-m2-minimal-chrome-and-overlays)

#### Unit Tests

- Browse renders map full viewport (or within shell).
- Filters overlay opens and tags apply (existing fetch logic); list overlay shows RouteList when opened.

#### Definition of Done

- [ ] Browse shows full-viewport map; no top bar above map.
- [ ] Tags filter and list view available via overlays; bbox fetch and clustering unchanged.
- [ ] Click route pin still navigates to route detail.

---

### Step 2.2: Browse — List Overlay and Pagination

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): browse list view in drawer/panel with pagination`

#### Agent Instructions

1. Implement list overlay (drawer or side/bottom panel) that contains `RouteList` with pagination.
2. When "List" is opened: load list data (paginated) if not already loaded; show RouteList. When user clicks a route, navigate to `/routes/:slug` and close overlay.
3. Ensure overlay can be closed (button, Escape, or click outside) so user returns to map-only view.

#### Definition of Done

- [ ] List overlay shows RouteList and pagination.
- [ ] Clicking a route navigates to route detail and closes overlay.
- [ ] Overlay closes without breaking map state.

---

## Phase 3: Route Detail Map-First

**Goal:** Route detail page shows full-viewport map with polyline and photo pins; metadata and gallery in a panel/drawer.

**Design Reference:** [PRD v4 - Route detail overlay](./PRD_v4.md#overlay-inventory-target)

---

### Step 3.1: Route Detail — Map Full Viewport, Layers in Shell

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): route detail map full viewport, polyline and pins from shell`

#### Agent Instructions

1. Refactor route detail so that when `slug` is present:
   - MapShell (or the single map used by the app) shows the **route polyline and photo pins** for that route. Move the map layer logic from `RouteView` into the shell or a hook consumed by the shell when `slug` is set (e.g. add sources/layers for route line and photos, fitBounds to route).
   - Do not render a second MapView on the route detail page; the shell's map is the only map.
   - Route metadata (title, description, distance, tags) and PhotoGallery (and add-photos for owner) must not be rendered above the map in document flow; they will move to an overlay in Step 3.2.
2. For this step: ensure route detail still loads route by slug, and that the map (in shell) displays the route and photos. You can temporarily keep metadata and gallery below the map or in a simple panel until Step 3.2.
3. Preserve: edit-photo-location modal, add-photos flow, selected photo sync between map and gallery. Ensure RouteView's map logic (sources, layers, cluster markers, fitBounds) is either in MapShell or a dedicated hook used when route slug is set; RouteView's metadata section will be reused in the overlay.

#### Design Constraints

- [PRD v4 - FR-M1, RouteView split](./PRD_v4.md#impact-surface)

#### Unit Tests

- Route detail page (e.g. `/routes/:slug`) shows full-viewport map with route polyline and photo pins.
- No duplicate MapView (only shell's map).

#### Definition of Done

- [ ] Route detail uses single map from shell; route and photo layers drawn on that map.
- [ ] fitBounds and pin selection behavior preserved.
- [ ] Edit location and add-photos modals still work.

---

### Step 3.2: Route Detail — Metadata and Gallery in Panel/Drawer

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): route detail metadata and photos in slide-out or bottom panel`

#### Agent Instructions

1. Move route metadata (title, description, distance, points, tags) and PhotoGallery (and add-photos button for owner) into a **slide-out panel** or **bottom sheet** (drawer). The panel can be opened by default when landing on `/routes/:slug`, or via a "Details" / "Info" control on the map.
2. Ensure the panel can be closed so the user sees only the map; reopening shows metadata and gallery again.
3. Preserve: photo selection sync (click pin → highlight in gallery; click gallery → highlight pin), edit location, add photos. Breadcrumb can be minimal (e.g. "Route" or route title in panel header) or removed if redundant with menu.

#### Definition of Done

- [ ] Metadata and PhotoGallery live in a panel/drawer, not above the map.
- [ ] Panel can open/close; map remains full viewport when panel is closed.
- [ ] All route detail functionality (gallery, add photos, edit location) intact.

---

## Phase 4: My Routes Overlay

**Goal:** My routes list appears in a drawer opened from the menu; map remains full viewport.

**Design Reference:** [PRD v4 - My routes overlay](./PRD_v4.md#overlay-inventory-target)

---

### Step 4.1: My Routes as Drawer from Menu

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): my routes list in drawer from app menu`

#### Agent Instructions

1. When user selects "My routes" from the app menu:
   - Option A: Navigate to `/routes/me` and show the map (full viewport) with a **drawer** open that contains the My Routes list (same content as current MyRoutes page). Clicking a route goes to `/routes/:slug` and closes the drawer.
   - Option B: Keep `/routes/me` as a route; that route renders MapShell and opens a drawer with the list on mount.
2. Reuse existing list UI (links to routes); ensure auth is required (protected route). If list is empty, show "You have not created any routes yet" inside the drawer.
3. Drawer can be closed so user sees only the map; "My routes" in menu reopens it or navigates to `/routes/me` with drawer open.

#### Definition of Done

- [ ] My routes list appears in a drawer; map fills viewport behind it.
- [ ] Clicking a route navigates to route detail (map + route overlay).
- [ ] Protected route; unauthenticated user redirected to login.

---

## Phase 5: Create Flow Overlay

**Goal:** Create route flow: map full viewport with preview line and markers; upload, order, and route details in a drawer/sheet.

**Design Reference:** [PRD v4 - Create route overlay](./PRD_v4.md#overlay-inventory-target)

---

### Step 5.1: Create Route — Map Full Viewport, Preview on Map

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): create route map full viewport, preview line and markers on shell map`

#### Agent Instructions

1. Refactor CreateRouteFromPhotos so that when user is on `/routes/create`:
   - MapShell (or the single app map) is used and fills the viewport.
   - The **preview line** and **photo markers** for the photos being added are drawn on this map (reuse existing logic: route preview source/layer, markers for placed photos). No second MapView in the create flow.
   - Upload, photo list, reorder, and "Route details" form are not yet moved; that is Step 5.2. For this step, ensure the create page uses the shell map and shows the preview; you can keep the form and list in a temporary layout (e.g. overlay or bottom sheet) so the map is visible.
2. "Place photo on map" modal: keep as modal with MapPicker; no change to flow.
3. Preserve: upload, place on map, reorder, submit to POST /v1/routes/from-photos; redirect to new route on success.

#### Definition of Done

- [ ] Create route uses shell map; preview line and markers visible.
- [ ] Place-photo modal still works.
- [ ] Submit still creates route and redirects.

---

### Step 5.2: Create Route — Upload and Form in Drawer/Sheet

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): create route upload and form in drawer or bottom sheet`

#### Agent Instructions

1. Move the entire "create route" content (upload, photo list with reorder, route details form) into a **drawer** or **bottom sheet** so the map is the main view. User opens the drawer to upload, reorder, and fill title/description/tags; map shows preview at all times.
   - Steps can remain: 1) Upload photos, 2) Order and place on map, 3) Route details (title, description, tags, public). All inside the same drawer/sheet or as sections within it.
   - Submit button in the drawer; on success, navigate to `/routes/:slug` and close create overlay.
2. Ensure validation and error messages (e.g. "Place N photos on map") still appear in the drawer.
3. User can close the drawer to see only the map (e.g. to inspect preview); reopening continues the flow.

#### Definition of Done

- [ ] Upload, reorder, and route details form live in drawer/sheet.
- [ ] Map always visible with preview when on create page.
- [ ] Full create flow works (upload, place, reorder, submit).

---

## Phase 6: Home and Login

**Goal:** Home shows map with optional CTA overlay or redirect; Login remains overlay/modal.

**Design Reference:** [PRD v4 - Home, Login](./PRD_v4.md#overlay-inventory-target)

---

### Step 6.1: Home Map-First, Login Overlay

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): home shows map with CTA overlay or redirect; login as overlay`

#### Agent Instructions

1. **Home (`/`):**
   - Option A: Render MapShell with a small **welcome/CTA overlay** (e.g. "Photowalker" + "Browse routes" / "Sign in to create") that can be dismissed. Map visible behind.
   - Option B: Redirect `/` to `/browse` so the first screen is the browse map. Ensure menu has "Home" that can go to `/` or `/browse` as desired.
   - Choose one approach and implement; document in PRD or roadmap if needed.
2. **Login:** Keep login as a **modal or full-screen overlay** when user clicks "Sign in" from menu. After successful auth, redirect back to map (e.g. `/browse` or previous route). No structural change to login form content.
3. Auth callback: no change to behavior; redirect to intended route after login.

#### Definition of Done

- [ ] Home either shows map + CTA overlay or redirects to browse map.
- [ ] Login opens as overlay; after login user returns to map.
- [ ] Auth callback and protected routes unchanged.

---

## Phase 7: Polish and Tests

**Goal:** Overlay accessibility, escape/close behavior, and test updates.

**Design Reference:** [PRD v4 - FR-M3](./PRD_v4.md#fr-m3-map-first-interaction)

---

### Step 7.1: Overlay Accessibility and Close Behavior

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `feat(frontend): overlay focus trap, escape to close, aria attributes`

#### Agent Instructions

1. Ensure all overlays (menu, filters, list, route detail panel, create drawer) support:
   - **Escape** to close (where appropriate).
   - **Focus trap** when open: tab cycles within overlay until closed (optional but recommended for modals/drawers).
   - **aria-modal**, **aria-label**, and **role** where appropriate (e.g. `role="dialog"` for modal-like overlays).
2. When overlay closes, return focus to the trigger (e.g. menu button or "Filters" button) if possible.
3. Map controls (e.g. MapLibre zoom) remain usable when overlay is open if overlay does not cover the whole map; if overlay is full-screen, ensure map is not the only focus target (e.g. close button first).

#### Definition of Done

- [ ] Escape closes overlays where appropriate.
- [ ] Focus management and ARIA attributes in place for key overlays.
- [ ] No regression in keyboard/screen reader usage.

---

### Step 7.2: Test Updates for Map-First Layout

**Branch:** `feat/v4-map-first-ui`  
**Commit Message:** `test(frontend): update tests for map-first layout and overlays`

#### Agent Instructions

1. Update tests that assume old layout:
   - **Browse:** Assert map is present; assert filters/list behind overlay (e.g. open "Filters" or "List" then assert content). Preserve mocks for MapView if still used.
   - **RouteDetail:** Assert route metadata and gallery in panel/drawer; assert map is full viewport. Update getByRole/getByTestId if structure changed.
   - **CreateRouteFromPhotos:** Assert create form/content in drawer; assert map or map container present. Preserve MapView/MapPicker mocks where applicable.
   - **RouteView:** If RouteView was split (map in shell, metadata in panel), update tests to reflect new structure; mock shell or map hook if needed.
2. Run full test suite (`npm run test` or `vitest run`); fix any failures.
3. Optionally add one E2E or smoke test: open app → open menu → go to Browse → see map; open Filters → apply tags; open List → see routes (if Playwright or similar is set up).

#### Definition of Done

- [ ] All existing unit tests updated and passing.
- [ ] No unnecessary removal of tests; only structure and queries updated.
- [ ] Lint passes.

---

## UAT Master Checklist (Map-First Overhaul)

| ID | Requirement | Verification |
|----|-------------|--------------|
| UAT-M1 | Map fills viewport on browse, route detail, create | Manual: no max-width or padding constraining map |
| UAT-M2 | Nav via minimal menu (FAB/hamburger); no full-width top bar | Manual: menu opens, links work |
| UAT-M3 | Browse: filters and list in overlays | Open Filters → tags; Open List → RouteList |
| UAT-M4 | Route detail: metadata and gallery in panel | Panel opens/closes; gallery and add-photos work |
| UAT-M5 | My routes: list in drawer | Menu → My routes → drawer with list; click route → detail |
| UAT-M6 | Create: upload/form in drawer; map shows preview | Create route flow end-to-end |
| UAT-M7 | Home: map + CTA or redirect | Home shows map or redirects to browse |
| UAT-M8 | Login: overlay; redirect after login | Sign in from menu → overlay; after login → map |
| UAT-M9 | Overlays close (Escape, button); focus returns | Keyboard and focus behavior |

---

## Git Workflow

- **Branch:** `feat/v4-map-first-ui` (single branch for overhaul) or one branch per phase (e.g. `feat/v4-map-first-phase-1`).
- **Commits:** One commit per step; message format `type(scope): description`.
- **PR:** Merge after all phases complete and tests pass, or merge by phase if preferred.

---

## Agent Quick Reference

1. **Read** PRD v4 (Map-First Overhaul) and the step's Agent Instructions.
2. **Implement** layout and overlays as specified; do not add new features.
3. **Preserve** existing behavior (fetch, clustering, auth, API calls).
4. **Update tests** for new DOM/layout; keep mocks where appropriate.
5. **Verify** Definition of Done before committing.

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-15
