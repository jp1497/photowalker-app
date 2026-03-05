# Photowalker Implementation Roadmap v6 — UI Overhaul for User Flows

**Version:** 1.0  
**Date:** 2026-02-21  
**Design Reference:** [PRD v6 — UI Overhaul for User Flows](./PRD_v6.md), [USER_FLOWS.md](./USER_FLOWS.md)  
**Prerequisite:** v4 map-first frontend (per [PRD v4](./PRD_v4.md) / [IMPLEMENTATION_ROADMAP_V4](./IMPLEMENTATION_ROADMAP_V4.md)) is in place. v5 basemap styling is optional.

---

## Overview

This roadmap defines the phased implementation of the UI overhaul in PRD v6. It realises the user flows in [USER_FLOWS.md](./USER_FLOWS.md): land on browse with welcome, photos-only default browse with lightbox, Explore routes as a left collapsible panel (with My routes filter and Create route button), route view and create in a shared bottom drawer, and account as a top-right circular icon only. Each phase has discrete steps with Agent Instructions, Design Constraints, and Definition of Done.

**Scope:** Frontend and backend. Backend adds photos-in-bbox (Phase 0); frontend consumes it for photo-level browse. One clear path; no optional phases.

---

## Design Authority

**Primary Reference:** [design/PRD_v6.md](./PRD_v6.md) (UI Overhaul for User Flows), [design/USER_FLOWS.md](./USER_FLOWS.md)

**Agent Rule:** Implement exactly what is specified in the PRD. Do NOT:
- Add the "additional user flows" from USER_FLOWS.md (filter/sort chips, search, share, save, offline) unless the PRD is updated
- Put My routes or Create route in the account menu or main menu (they live in the Explore panel only)
- Introduce mobile-specific breakpoints or behaviour beyond "design for easy conversion" (FR-U7)
- Change backend API contracts except for the photos-in-bbox endpoint (Phase 0)

**Permission to Deviate:** If a technical constraint requires a design change, document the proposed change and stop. Do not implement alternatives without approval.

---

## Phase Overview

| Phase | Name | Steps | Est. Commits |
|-------|------|-------|---------------|
| 0 | Backend: photos-in-bbox | 1 | 1 |
| 1 | Routing, welcome, and chrome | 4 | 4 |
| 2 | Shared components | 3 | 3 |
| 3 | Browse photos-only and map modes | 3 | 3 |
| 4 | Explore routes panel | 4 | 4 |
| 5 | Route view in bottom drawer | 2 | 2 |
| 6 | Create route in bottom drawer | 2 | 2 |
| 7 | My routes as filter only; remove /routes/me | 1 | 1 |
| 8 | Polish and tests | 2 | 2 |
| **Total** | | **22** | **22** |

---

## Phase 0: Backend — photos-in-bbox

**Goal:** Add an API so the frontend can show photo pins in the viewport for photos-only browse. This phase is part of the implementation path; the frontend will consume this endpoint in Phase 3.

**Design Reference:** [PRD v6 — Backend Considerations](./PRD_v6.md#backend-considerations)

---

### Step 0.1: Add GET /v1/photos (or equivalent) for bbox

**Branch:** `feat/v6-ui-overhaul` (or `feat/v6-photos-bbox`)  
**Commit Message:** `feat(api): add photos-in-bbox endpoint for photo-level browse`

#### Agent Instructions

1. Add a new endpoint (e.g. **GET /v1/photos** or **GET /v1/discovery/photos**) with query params: `bbox` (min_lon,min_lat,max_lon,max_lat), optional `page`, `per_page`. Return photos that have a non-null location within the bbox, with fields needed for map pins and lightbox: id, caption/title, user (id, name), route ids (or route slugs) that contain the photo, image URL or path, location.
2. Reuse existing bbox validation (e.g. max area 200 km²) and pagination patterns from GET /v1/routes. Ensure only public photos (e.g. from public routes) are returned, or document visibility rules.
3. Add schema, service, and integration tests. Document the endpoint in OpenAPI/README.
4. Frontend will consume this endpoint in Phase 3 for browse-photos mode.

#### Definition of Done

- [ ] Endpoint returns photos in bbox with required fields.
- [ ] Bbox and pagination validated; only public (or permitted) photos returned.
- [ ] Tests and API docs updated.

---

## Phase 1: Routing, welcome, and chrome

**Goal:** Root redirects to browse; welcome modal on browse when not signed in; account in top-right only; new expandable drawer menu with Browse and Routes.

**Design Reference:** [PRD v6 - FR-U1](./PRD_v6.md#fr-u1-redirect-root-to-browse-and-welcome-on-browse), [FR-U5](./PRD_v6.md#fr-u5-account-in-top-right-only), [FR-U6](./PRD_v6.md#fr-u6-my-routes-as-filter-only-no-dedicated-routesme-page)

---

### Step 1.1: Redirect root to browse

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): redirect / to /browse`

#### Agent Instructions

1. In `frontend/src/App.tsx`, change the route for `/` so that it **redirects** to `/browse` (use React Router's `<Navigate to="/browse" replace />` or equivalent). Remove the `Home` component from rendering at `/`.
2. Ensure MapShellLayout still wraps `/browse` and other map routes. The redirect should happen before or inside the layout so the user lands on the browse page with the map visible.
3. Remove `frontend/src/pages/Home.tsx` as a route; reuse its welcome copy for the WelcomeModal on Browse (Step 1.2), then delete the file or keep only for reference. Do not render Home at any route.

#### Design Constraints

- [PRD v6 - Routing and landing](./PRD_v6.md#routing-and-landing)
- [PRD v6 - Impact Surface - App.tsx](./PRD_v6.md#routing-and-app-shell)

#### Unit Tests

- Navigating to `/` results in redirect to `/browse` (replace in history).
- No route renders the old Home page at `/`.

#### Definition of Done

- [ ] `/` redirects to `/browse` with replace.
- [ ] Home is not a standalone route; welcome content will move to Browse in Step 1.2.

---

### Step 1.2: Welcome modal on Browse

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): welcome modal on browse when not signed in`

#### Agent Instructions

1. On the **Browse** page, when the user is **not** authenticated, show a **dismissible welcome modal**. Content: short app description (e.g. "Create photowalks, share them with others and discover a new side of your city"), primary CTAs: **"Browse the map"** and **"Create account"**, and optionally **"Maybe later"** to dismiss.
2. **Persistence:** When the user dismisses the modal (e.g. "Maybe later" or close button), store dismissal in **sessionStorage** (e.g. key `photowalker_welcome_dismissed`). On subsequent loads in the same session, do not show the modal again. Authenticated users never see the modal.
3. Reuse or extract the welcome copy and layout from the current Home component if helpful. Ensure the modal is accessible (focus trap when open, Escape to close, aria-label).
4. "Create account" should navigate to `/login` (or trigger sign-in). "Browse the map" can simply close the modal and leave the user on the map.

#### Design Constraints

- [PRD v6 - FR-U1](./PRD_v6.md#fr-u1-redirect-root-to-browse-and-welcome-on-browse)

#### Unit Tests

- When not authenticated and not dismissed, welcome modal is shown on Browse.
- After dismissing, modal does not show again in same session (sessionStorage).
- When authenticated, welcome modal is not shown.

#### Definition of Done

- [ ] Welcome modal appears on `/browse` when unauthenticated and not dismissed.
- [ ] Dismissal persisted in sessionStorage; modal does not reappear in same session.
- [ ] Authenticated users do not see the modal.
- [ ] Escape and focus trap work.

---

### Step 1.3: Account icon top-right

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): account as top-right circular icon with Sign in, Settings, Sign out`

#### Agent Instructions

1. Create an **AccountIcon** (or equivalent) component: a **circular user icon** (avatar when authenticated, generic/user icon when not) positioned in the **top-right** of the viewport (e.g. `position: fixed; top: 0.75rem; right: 0.75rem` with sufficient z-index). Click opens a **dropdown** (popover or menu).
2. Dropdown contents **only:** **Sign in** (when not authenticated), **Settings**, **Sign out** (when authenticated). Do **not** include "My routes" or "Create route"; those will live in the Explore routes panel.
3. Sign in: navigate to `/login` or trigger existing Google OAuth flow. Sign out: call existing logout. Settings: can be a placeholder link or route for now if no settings page exists.
4. Ensure dropdown closes on Escape and outside click; focus returns to the icon when closed. Use appropriate ARIA (aria-haspopup, aria-expanded, role="menu" or role="dialog").

#### Design Constraints

- [PRD v6 - FR-U5](./PRD_v6.md#fr-u5-account-in-top-right-only)
- [PRD v6 - Impact Surface - AccountIcon](./PRD_v6.md#new-or-shared-components)

#### Unit Tests

- Account icon is visible in top-right; click opens dropdown with Sign in / Settings / Sign out only.
- Sign in and Sign out trigger correct behaviour (navigate or logout).

#### Definition of Done

- [ ] Circular account icon in top-right; dropdown has only Sign in, Settings, Sign out.
- [ ] No My routes or Create route in account dropdown.
- [ ] Accessible (keyboard, ARIA).

---

### Step 1.4: New expandable drawer menu (Browse, Routes)

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): replace menu with expandable drawer menu (Browse, Routes)`

#### Agent Instructions

1. **Remove** the current **AppMenu** (top-left "Menu" button and popup) entirely. Do not retain it.
2. Add a **new expandable drawer-style menu**: a control (e.g. top-left) that opens a **drawer** (slide-out or overlay). The drawer has **two top-level options only: Browse, Routes**.
   - **Browse:** Navigates to `/browse` and closes the drawer. Use when the user wants to go to the photos-only map view.
   - **Routes:** Opens the left Explore routes panel (the Routes panel) and closes the drawer. If the panel does not exist yet (Phase 2/4), set state so that when the panel is built it opens (e.g. `setRoutesPanelOpen(true)`); or render a placeholder panel for this step.
3. The drawer expands from the left (or as an overlay) and collapses/closes when the user selects an option or clicks outside. No other menu items (no Home, My routes, Create route, Sign in/out); those are in the Routes panel or account dropdown.
4. Keep **AccountIcon** (Step 1.3) separate and in top-right; account is not inside this drawer menu.

#### Design Constraints

- [PRD v6 - FR-U5, FR-U6](./PRD_v6.md#fr-u5-account-in-top-right-only) — My routes and Create route not in menu.
- [PRD v6 - Impact Surface - AppMenu](./PRD_v6.md#routing-and-app-shell)

#### Unit Tests

- New drawer menu opens with only Browse and Routes; Browse navigates to /browse; Routes opens the Routes panel (or placeholder). No My routes, Create route, or Sign in/out in drawer.
- Account remains in top-right only.

#### Definition of Done

- [ ] Current AppMenu removed. New expandable drawer menu has only Browse and Routes.
- [ ] Browse → /browse; Routes → opens Routes panel. Panel UI can be placeholder until Phase 2/4.

---

## Phase 2: Shared components

**Goal:** BottomDrawer, ExploreRoutesPanel shell, and reuse of PhotoGallery lightbox for browse so that Browse, Routes panel, route view, and create flow can use them.

**Design Reference:** [PRD v6 - FR-U4](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create), [Impact Surface - New or shared components](./PRD_v6.md#new-or-shared-components)

---

### Step 2.1: BottomDrawer component

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): add shared BottomDrawer with peek and expand`

#### Agent Instructions

1. Create **BottomDrawer** (e.g. `frontend/src/components/common/BottomDrawer.tsx` or `frontend/src/components/drawer/BottomDrawer.tsx`): bottom-anchored drawer that accepts `open`, `onClose`, `children`, and optional `title` or `peekContent` (e.g. one line or thumbnail for peek state).
2. **Peek state:** When "peeked", show a strip (e.g. title bar or single line) so the map remains largely visible. **Expanded state:** User can expand (e.g. button or click on peek bar) to show full scrollable content. Use height in **%** or **max-height** (e.g. 60% or 80vh) so that a future drag handle or full-height expand on mobile is not blocked; avoid a single fixed pixel height for the expanded state.
3. **Scrollable body:** The main content area (children) should scroll when expanded. Include a close button and support Escape to close; focus trap when open; return focus to trigger on close.
4. **z-index:** Drawer sits above the map but below modals (e.g. lightbox, login). Document the component contract (props, peek vs expand control) so route view and create flow can reuse it.

#### Design Constraints

- [PRD v6 - FR-U4, FR-U7](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create)
- [PRD v6 - BottomDrawer](./PRD_v6.md#new-or-shared-components)

#### Unit Tests

- BottomDrawer renders when open; shows peek and can expand; onClose and Escape close it.
- Focus trap and focus return when closed.

#### Definition of Done

- [ ] BottomDrawer exists with peek and expanded states, scrollable body, onClose, Escape.
- [ ] No fixed pixel height that would block future mobile full-height expand.
- [ ] Accessible (focus, ARIA).

---

### Step 2.2: ExploreRoutesPanel shell

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): add ExploreRoutesPanel collapsible left panel shell`

#### Agent Instructions

1. Create **ExploreRoutesPanel** (e.g. `frontend/src/components/explore/ExploreRoutesPanel.tsx`): a **left collapsible panel** that can be **expanded** (show full width, e.g. 320px or 30rem) or **collapsed** to an **icon strip** (e.g. narrow bar with an icon only, ~48px). State: `open` (visible vs hidden) and `collapsed` (full vs icon strip). Parent (or shell) controls open state from the drawer menu (Routes); panel can toggle collapsed internally or via prop.
2. **Structure:** When expanded, the panel has: (a) header with title "Routes" (or "Explore routes") and collapse button, (b) placeholder or slot for filters (All, My routes), (c) placeholder or slot for route list (RouteList will go here in Phase 4), (d) placeholder or slot for "Create route" button. For this step, placeholders or minimal content are fine (e.g. "Filters", "Route list", "Create route" text).
3. **Layout:** Panel overlays or sits in a column on the left; map fills the rest. Use CSS so that on smaller viewports the panel could later be full-width or bottom sheet (no hard desktop-only assumptions). z-index below modals but above map.
4. **Map context:** If the app uses MapContext or similar, the panel does not need to set "highlighted route" yet; that is Phase 4. Just ensure the panel can receive callbacks (e.g. onRouteSelect, onHighlightRoute) for later wiring.

#### Design Constraints

- [PRD v6 - FR-U3, FR-U7](./PRD_v6.md#fr-u3-menu-bar-and-explore-routes-left-panel)
- [PRD v6 - ExploreRoutesPanel](./PRD_v6.md#new-or-shared-components)

#### Unit Tests

- ExploreRoutesPanel renders; can expand/collapse; has slots for filters, list, Create button.
- Panel does not assume desktop-only layout (e.g. width in rem or %).

#### Definition of Done

- [ ] ExploreRoutesPanel exists; collapsible to icon strip; structure ready for filters, list, Create button.
- [ ] Open state driven by parent (menu bar); collapse state can be internal or prop.

---

### Step 2.3: Reuse PhotoGallery lightbox for browse photo detail

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): reuse PhotoGallery lightbox for browse single-photo view`

#### Agent Instructions

1. The **lightbox is already implemented** in [PhotoGallery](frontend/src/components/photos/PhotoGallery.tsx) and used in the route detail view. **Reuse** it for the browse photo click: when the user clicks a photo pin on the map (Phase 3), show the same lightbox behaviour (single photo, caption, prev/next if only one photo, close on Escape/backdrop). Do **not** create a new PhotoLightbox component.
2. Use **PhotoGallery** in a **single-photo mode** on Browse: pass an array of one photo (the clicked photo) so the existing lightbox opens with that photo. Optionally extend PhotoGallery to accept a minimal "single photo + user + routes" shape for browse (caption, user name, list of routes containing the photo with links to open that route in the drawer). If the gallery component expects multiple photos, pass `[photo]` and hide prev/next when length is 1.
3. "Open route" from the lightbox (when showing routes that contain the photo) should set the selected route slug and open the route in the bottom drawer (navigate to `/routes/:slug` per Step 4.4). Ensure closing the lightbox returns focus to the map or pin trigger.

#### Design Constraints

- [PRD v6 - FR-U2](./PRD_v6.md#fr-u2-photos-only-default-browse-and-photo-lightbox)
- [PRD v6 - Impact Surface](./PRD_v6.md#new-or-shared-components) — reuse existing PhotoGallery lightbox.

#### Unit Tests

- Browse photo pin click opens PhotoGallery lightbox with that photo; close and Escape work; open-route opens drawer. Accessible (focus trap, ARIA).

#### Definition of Done

- [ ] PhotoGallery lightbox is reused for browse single-photo view; no new PhotoLightbox component.
- [ ] Single photo + user + routes (with open-route) supported for browse; accessible.

---

## Phase 3: Browse photos-only and map modes

**Goal:** Default browse shows photo pins from the photos-in-bbox API; photo click opens PhotoGallery lightbox; MapShell supports browse-photos mode.

**Design Reference:** [PRD v6 - FR-U2](./PRD_v6.md#fr-u2-photos-only-default-browse-and-photo-lightbox), [Map and data](./PRD_v6.md#map-and-data)

---

### Step 3.1: MapShell browse-photos mode and photo pins

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): MapShell browse-photos mode with photo pins in bbox`

#### Agent Instructions

1. Extend **MapShell** / **MapContext** to support a **browse-photos** mode (in addition to existing browse/detail/create). In this mode, the map shows **photo pins** for photos in the current viewport (bbox). Layer/source IDs must be distinct (e.g. `browse-photos-source`, `browse-photos-layer`) so they do not conflict with route layers.
2. **Data:** Use **GET /v1/photos?bbox=** (Phase 0). Fetch photos in bbox and add them as a GeoJSON point layer; click returns photo id for the lightbox (Step 3.2).
3. **Center:** Use `usePreferredMapCenter` so the map is centred on user location when available. When bbox changes (moveend), refetch photos and update the layer.
4. **Browse page:** Do not show the old route list overlay; route list lives in the Routes panel (Phase 4). Remove or hide the "Routes" button and list overlay from Browse so the default is map-only with photo pins.

#### Design Constraints

- [PRD v6 - Map and data](./PRD_v6.md#map-and-data), [Backend Considerations](./PRD_v6.md#backend-considerations)

#### Unit Tests

- MapShell in browse-photos mode adds photo (or route) layer; bbox change triggers fetch; no duplicate sources/layers with detail or create modes.

#### Definition of Done

- [ ] browse-photos mode shows photo pins in viewport (from GET /v1/photos?bbox=).
- [ ] Bbox-based fetch; distinct layer/source IDs.
- [ ] Browse page default is map with pins only; no route list on browse.

---

### Step 3.2: Browse — photo click opens PhotoGallery lightbox

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): browse photo pin click opens PhotoGallery lightbox`

#### Agent Instructions

1. On **Browse**, when the user clicks a **photo pin**, open the **PhotoGallery** lightbox (Step 2.3) with that photo's image, title (caption), user, and routes that contain it. "Open route" in the lightbox navigates to `/routes/:slug` and opens the route in the bottom drawer (drawer content is Phase 5).
2. Ensure closing the lightbox returns focus to the map. Photo pins should have adequate hit target (e.g. 44px) for touch (FR-U7).

#### Design Constraints

- [PRD v6 - FR-U2](./PRD_v6.md#fr-u2-photos-only-default-browse-and-photo-lightbox)

#### Unit Tests

- Click photo pin opens PhotoGallery lightbox with correct photo; close returns focus; open-route opens drawer.

#### Definition of Done

- [ ] Photo pin click opens PhotoGallery lightbox; open-route opens route drawer.
- [ ] Hit targets and focus behaviour correct.

---

### Step 3.3: Remove route list and filters from Browse default

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `refactor(frontend): remove route list and filters overlay from Browse page`

#### Agent Instructions

1. Remove the **Routes** button and **route list overlay** from the Browse page. Remove the **Filters** overlay from Browse (filters move to the Explore routes panel in Phase 4). If any tag or bbox filter is still needed for the photo/route fetch, keep the fetch logic but trigger it from map moveend only; no filter UI on Browse.
2. Ensure Browse page only shows: map (full viewport), photo pins, and when a pin is clicked the PhotoGallery lightbox. Welcome modal remains (Phase 1). No left or right overlay for routes or filters on Browse itself.

#### Definition of Done

- [ ] Browse has no route list or filters UI; routes and filters are only in Explore panel.
- [ ] Fetch logic for map pins (photos or routes) still works (bbox, optional tags if needed later in panel).

---

## Phase 4: Explore routes panel — full implementation

**Goal:** Panel content: filters (All, My routes), route cards, Create route button; collapse; hover/select highlights route on map and opens route in drawer on click.

**Design Reference:** [PRD v6 - FR-U3](./PRD_v6.md#fr-u3-menu-bar-and-explore-routes-left-panel)

---

### Step 4.1: Panel filters and route list

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): Explore panel filters All/My routes and paginated route cards`

#### Agent Instructions

1. In **ExploreRoutesPanel**, add **filters:** "All" and "My routes" (when authenticated). "My routes" filters by current user: call GET /v1/routes with `author_id` equal to current user id. "All" uses existing browse params (bbox, optional tags). Use existing `getBrowseRoutes` and ensure `author_id` is supported in the API (it is in backend discovery).
2. Add **route list** inside the panel: reuse **RouteList** (or route cards with thumbnail, title, summary). Data from `getBrowseRoutes` with bbox from current map viewport (or a default) and author_id when "My routes" is selected. Pagination: on page change, refetch with new page. When the panel opens, fetch with current bbox so the list is relevant to the map.
3. **Create route** button: primary CTA in the panel. Click opens the create-route bottom drawer. If user is not authenticated, redirect to `/login` with return URL (e.g. `/browse?open=create` or store in sessionStorage). Protected route behaviour per existing app.
4. Wire panel open state to the new drawer menu from Step 1.4 so **Routes** opens this panel.

#### Design Constraints

- [PRD v6 - FR-U3](./PRD_v6.md#fr-u3-menu-bar-and-explore-routes-left-panel)

#### Unit Tests

- Panel shows All and My routes (when signed in); My routes filters by current user. Route list loads and paginates. Create route button opens drawer or redirects to login.

#### Definition of Done

- [ ] Filters All / My routes work; route list is paginated and uses bbox (+ author_id when My routes).
- [ ] Create route button opens drawer (or login redirect when not authenticated).
- [ ] Panel opens from menu bar.

---

### Step 4.2: Panel collapse to icon strip

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): Explore panel collapses to icon strip`

#### Agent Instructions

1. Implement **collapse** of ExploreRoutesPanel to a narrow **icon strip** (e.g. icon only, ~48px wide). Expand again via icon or button on the strip to show full panel. Collapse state: retain during session (e.g. React state in parent or URL query like `?panel=collapsed`). Do not persist across sessions.
2. When collapsed, the map gains horizontal space; the strip remains visible so the user can re-expand. Ensure the strip has an accessible label (e.g. "Expand Explore routes").

#### Definition of Done

- [ ] Panel can collapse to icon strip and expand again.
- [ ] Collapse state retained during session.

---

### Step 4.3: Route card hover/select highlights route on map (separate layer)

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): route card hover/select adds highlighted-route layer on map`

#### Agent Instructions

1. When the user **hovers** or **selects** (click/tap) a route card in the Explore panel, the map should **highlight that route's photos** and **fade** other photos. Implement this by **adding a separate map layer** for the highlighted route: when a route is highlighted, add a **dedicated layer** (e.g. `highlighted-route-photos` with its own source) that draws that route's photo points (from GET route by slug / route detail). Keep the base browse-photos layer; optionally reduce its opacity so the highlighted layer stands out, or leave base at full opacity and draw the highlighted layer on top with distinct styling.
2. **Data:** Use existing GET route by slug to get the route's photo locations; create a GeoJSON point source for the highlighted route and a symbol/circle layer. Use distinct source and layer IDs (e.g. `highlighted-route-source`, `highlighted-route-layer`) so they do not conflict with browse-photos and route-detail modes. When **no** route is selected, remove or clear the highlighted-route layer so the map returns to default (all photos at full opacity).
3. Use **selection** (click/tap) as well as hover so that touch devices can highlight by tapping (FR-U7). Expose a callback from the panel (e.g. `onHighlightRoute(routeId | null)`) that the shell or map context uses to set the highlighted route and add/remove the separate layer.

#### Design Constraints

- [PRD v6 - FR-U3](./PRD_v6.md#fr-u3-menu-bar-and-explore-routes-left-panel), [Map state and layers](./PRD_v6.md#map-state-and-layers)

#### Unit Tests

- Setting highlighted route adds the separate highlighted-route layer; clearing removes it. Selection and hover both trigger highlight.

#### Definition of Done

- [ ] Highlighted route is drawn as a **separate layer**; base browse-photos layer unchanged or faded.
- [ ] Clear selection removes the highlighted layer. Touch: tap works for highlight.

---

### Step 4.4: Route card click opens route in bottom drawer; URL strategy

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): route card click opens drawer; /browse?route=:slug when exploring, /routes/:slug when opened`

#### Agent Instructions

1. **URL strategy:** Use two distinct URL states. **While exploring routes** (hover/select in the panel, not yet opened in drawer): set the route slug in app state and in the URL as **`/browse?route=:slug`**. **When the user clicks a route card to open the route** (drawer opens): navigate to **`/routes/:slug`** and open the bottom drawer with that route's content. So: exploring = query param on browse; opening the route = path change to /routes/:slug.
2. When the user **clicks** a route card, navigate to **/routes/:slug** and open the bottom drawer with that route's content (route view: title, metadata, gallery). The drawer content is implemented in Phase 5; for this step ensure the drawer opens and shows a loading state or placeholder until Phase 5 fills it.
3. Closing the drawer leaves the URL as `/routes/:slug` so the user can reopen from the panel or a floating button; do not auto-navigate back to /browse. The panel remains open so the user can select another route (which will navigate to the new /routes/:slug and update the drawer).

#### Definition of Done

- [ ] Exploring (hover/select) in panel: URL is `/browse?route=:slug`.
- [ ] Clicking a route card: navigate to `/routes/:slug` and open bottom drawer with that route.
- [ ] Closing drawer keeps URL at /routes/:slug; panel state unchanged.

---

## Phase 5: Route view in bottom drawer

**Goal:** Route detail content (metadata, PhotoGallery) lives in the shared BottomDrawer; map shows route polyline and pins.

**Design Reference:** [PRD v6 - FR-U4](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create)

---

### Step 5.1: Route detail content inside BottomDrawer

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): route view content in BottomDrawer`

#### Agent Instructions

1. Refactor **RouteDetail** so that when a route is selected (from Explore panel or from map/direct URL), the **route content** (title, metadata, PhotoGallery, and owner actions: edit location, add photos) is rendered **inside the BottomDrawer**, not in the current side panel overlay.
2. The **map** (MapShell) continues to show the **route polyline and photo pins** for that route when the route drawer is open (existing detail mode). MapShell mode should switch to "detail" (or equivalent) when route slug is set so the route layer is visible. Ensure only one map instance; no duplicate MapView.
3. Reuse existing **PhotoGallery**, **RouteView** metadata (title, description, distance, tags), and **PhotoUploadForm** / edit-location modal inside the drawer. Peek state can show route title and thumbnail; expanded state shows full scrollable gallery and metadata.
4. Remove the **current** route detail panel overlay (the closable panel that sits over the map in today's RouteDetail). Replace it entirely with the BottomDrawer. The floating "reopen" button for the panel can become "Expand" on the drawer peek bar if needed.

#### Design Constraints

- [PRD v6 - FR-U4](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create), [Impact Surface - RouteDetail](./PRD_v6.md#pages)

#### Unit Tests

- Route detail (metadata + gallery) renders inside BottomDrawer; map shows route; edit location and add photos still work.

#### Definition of Done

- [ ] Route view content (metadata, PhotoGallery, owner actions) is in BottomDrawer.
- [ ] Map shows route polyline and pins when route drawer is open.
- [ ] Old route detail panel overlay removed.

---

### Step 5.2: Route selection from panel and URL

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): route selection from Explore panel and URL opens drawer`

#### Agent Instructions

1. Ensure that when the user selects a route from the **Explore panel** (Step 4.4), the **BottomDrawer** opens with that route's content and the map switches to show that route. When the user navigates directly to **/routes/:slug** (e.g. shared link or back button), the same behaviour: map shows route, drawer opens with route content.
2. **MapShellLayout** and **App** routing: keep **/routes/:slug** as a route that renders a page (e.g. RouteDetail) which, in turn, renders the map (via MapShell) and the drawer with route content. So direct visit to /routes/:slug still works; the "page" is minimal (map + drawer). Ensure MapShell receives slug so it can set detail mode and load route layers.
3. When the drawer is closed on the route detail page, leave the URL as **/routes/:slug** so the user can reopen the drawer from the panel or a floating button; do not navigate back to /browse. This keeps back/forward and sharing consistent.

#### Definition of Done

- [ ] Route selected from panel opens drawer with route content; map shows route.
- [ ] Direct /routes/:slug opens map + drawer with that route.
- [ ] Close drawer behaviour documented and consistent.

---

## Phase 6: Create route in bottom drawer

**Goal:** Create flow content in shared BottomDrawer; entry only from Explore panel; protected route redirect.

**Design Reference:** [PRD v6 - FR-U4](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create)

---

### Step 6.1: Create flow content inside BottomDrawer

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): create route flow in BottomDrawer`

#### Agent Instructions

1. Refactor **CreateRouteFromPhotos** so that the **entire create flow** (upload photos, place on map, reorder, route title/description, submit) is rendered **inside the same BottomDrawer** component used for route view. The map shows the **create preview** (line and markers) when the create drawer is open (existing create mode in MapShell).
2. Reuse existing steps: upload, MapPicker for "place photo on map", drag-to-reorder, route details form, submit to POST /v1/routes/from-photos. On success, navigate to the new route (e.g. /routes/:slug) and open the route view drawer, or close and show success toast. No change to API or validation logic.
3. Remove any **separate** drawer or overlay that CreateRouteFromPhotos currently uses; the only container is the shared BottomDrawer. Ensure peek state shows something useful (e.g. "Create route" title) and expanded state is scrollable for the form and photo list.

#### Design Constraints

- [PRD v6 - FR-U4](./PRD_v6.md#fr-u4-bottom-drawer-for-route-view-and-create)
- [PRD v6 - Impact Surface - CreateRouteFromPhotos](./PRD_v6.md#pages)

#### Unit Tests

- Create flow (upload, place, reorder, submit) works inside BottomDrawer; map shows create preview; submit creates route and navigates or closes.

#### Definition of Done

- [ ] Create route content is in BottomDrawer; map shows create preview.
- [ ] Full create flow works; no duplicate drawer component.

---

### Step 6.2: Create route entry only from Explore panel

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): create route entry only from Explore panel; remove from menu`

#### Agent Instructions

1. **Entry point:** The only way to open the create-route drawer is the **Create route** button in the **Explore routes panel**. Remove any other entry (e.g. from account menu or main menu if still present). Ensure **/routes/create** is still a protected route: if the user is not authenticated and tries to open create (e.g. via panel button), redirect to **/login** with return URL so that after login they can be sent back to open the create drawer.
2. **URL:** When the user clicks "Create route" in the panel, navigate to **`/routes/create`** and open the drawer (map in create mode, drawer with create form). This preserves a shareable create URL and back/forward.
3. Verify that the main menu and account dropdown do **not** contain "Create route". Only the Explore panel has the Create route button.

#### Definition of Done

- [ ] Create route drawer opens only from Explore panel button.
- [ ] Unauthenticated user is redirected to login with return URL.
- [ ] No Create route in menu or account dropdown.

---

## Phase 7: My routes as filter only; remove /routes/me

**Goal:** My routes only as a filter in the Routes panel. Remove /routes/me as a view entirely.

**Design Reference:** [PRD v6 - FR-U6](./PRD_v6.md#fr-u6-my-routes-as-filter-only-no-dedicated-routesme-page)

---

### Step 7.1: My routes filter only; remove /routes/me route and MyRoutes page

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): My routes as panel filter only; remove /routes/me route and MyRoutes page`

#### Agent Instructions

1. Ensure **My routes** appears **only** as a **filter** inside the Routes (Explore routes) panel (Step 4.1). There is no "My routes" link in the drawer menu or account dropdown.
2. **Remove the /routes/me route:** In App.tsx, remove the route for `/routes/me` and the **MyRoutes** page. Do not implement /routes/me as a deep link or redirect. Users reach "My routes" only by opening the Routes panel (via the drawer menu) and selecting the "My routes" filter.
3. Delete or repurpose **frontend/src/pages/MyRoutes.tsx**: the list content is already in the Routes panel when the My routes filter is selected; the standalone page is no longer used. Remove any links or redirects that pointed to /routes/me (e.g. from old menu or docs). If the user navigates to /routes/me directly (e.g. old bookmark), show a 404 or redirect to `/browse` with no special panel state.
4. Protected behaviour: unauthenticated users who apply "My routes" in the panel are redirected to login with a return URL that brings them back to browse (and they can reopen the panel and choose My routes after login).

#### Design Constraints

- [PRD v6 - FR-U6](./PRD_v6.md#fr-u6-my-routes-as-filter-only-no-dedicated-routesme-page)
- [PRD v6 - Impact Surface - MyRoutes](./PRD_v6.md#pages)

#### Unit Tests

- My routes is only in the Routes panel as a filter. No /routes/me route; visiting /routes/me results in 404 or redirect to /browse. Unauthenticated user applying My routes is redirected to login.

#### Definition of Done

- [ ] No My routes in drawer menu or account menu; only in Routes panel as filter.
- [ ] /routes/me route and MyRoutes page removed. Direct /routes/me → 404 or redirect to /browse.
- [ ] Protected behaviour for unauthenticated users applying My routes filter.

---

## Phase 8: Polish and tests

**Goal:** Map mode coordination, touch targets and accessibility (FR-U7), and test updates.

**Design Reference:** [PRD v6 - FR-U7](./PRD_v6.md#fr-u7-mobile-ready-structure), [Impact Surface - Tests](./PRD_v6.md#tests)

---

### Step 8.1: Map mode coordination and touch targets

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `feat(frontend): map mode coordination and touch-friendly targets`

#### Agent Instructions

1. **Map modes:** Ensure MapShell cleanly supports and switches between: (1) **browse-photos** (default on /browse, photo or route pins), (2) **explore-route-highlight** (when a route is hovered/selected in panel, highlight that route's photos and fade others), (3) **detail** (when a route is open in drawer, show route polyline and pins), (4) **create** (when create drawer is open, show preview line and markers). No duplicate sources or layers; clear teardown when switching modes.
2. **Touch targets (FR-U7):** Ensure **photo pins** and **route cards** have a minimum touch target (e.g. 44px) or are wrapped in a hit area that meets accessibility guidelines. Route card "highlight on map" must work with **tap/select** as well as hover so touch devices can highlight by tapping.
3. **Panel and drawer:** Confirm the left panel and bottom drawer do not use a single fixed pixel height/width that would block future responsive behaviour (e.g. panel full-width on small screens, drawer drag handle). Use rem, %, or max-height/max-width where possible.

#### Design Constraints

- [PRD v6 - FR-U7](./PRD_v6.md#fr-u7-mobile-ready-structure), [Map state and layers](./PRD_v6.md#map-state-and-layers)

#### Definition of Done

- [ ] All four map modes work without layer/source conflicts; clean teardown.
- [ ] Touch targets and tap-to-highlight in place.
- [ ] Panel and drawer structured for future responsive use.

---

### Step 8.2: Test updates and UAT

**Branch:** `feat/v6-ui-overhaul`  
**Commit Message:** `test(frontend): update tests for v6 user flows and add UAT checklist`

#### Agent Instructions

1. **Unit tests:** Update tests that assume old layout or entry points: (a) **Routing:** `/` redirects to `/browse`; welcome modal on browse when not authenticated and not dismissed. (b) **Browse:** Default view shows photo/route pins; click opens lightbox or drawer; no route list on browse. (c) **Explore panel:** Open from menu; filters All/My routes; route list and Create button; route card click opens drawer; hover/select highlights on map. (d) **Bottom drawer:** Route view and create flow render in drawer; peek/expand and close. (e) **Account:** Top-right icon only; dropdown has Sign in, Settings, Sign out only. (f) **My routes:** Only in panel as filter; /routes/me route removed. Preserve or add mocks for MapView, MapPicker, api client where appropriate.
2. **E2E:** If the project has E2E tests, update them for new entry points (no Home at /, drawer menu with Browse and Routes only, no /routes/me, account in top-right). Add or update smoke: land on browse → welcome if not signed in → dismiss → see map; open drawer → Routes → panel opens → see route list → click Create route (login redirect or drawer).
3. Run full test suite and fix failures; run lint. Document **UAT checklist** (below) in the roadmap or in a separate UAT file for manual verification. See **[design/UAT_CHECKLIST_V6.md](./UAT_CHECKLIST_V6.md)** for the manual sign-off checklist.

#### Definition of Done

- [ ] All unit tests updated and passing.
- [ ] E2E updated if applicable.
- [ ] Lint passes.
- [ ] UAT checklist available for manual sign-off.

---

## UAT Master Checklist (v6 User Flows)

| ID | Requirement | Verification |
|----|-------------|--------------|
| UAT-U1 | Root redirects to browse | Navigate to `/` → redirect to `/browse` |
| UAT-U2 | Welcome modal on browse when not signed in | Not signed in → modal with Browse the map, Create account; dismiss → not shown again in session |
| UAT-U3 | Account in top-right only; Sign in, Settings, Sign out | No My routes or Create route in account dropdown |
| UAT-U4 | Expandable drawer menu: Browse, Routes | Open drawer → only Browse and Routes; Browse → /browse; Routes → panel opens |
| UAT-U5 | Browse default: photo pins only; click → PhotoGallery lightbox | No route list on browse; pin click opens PhotoGallery lightbox |
| UAT-U6 | Explore panel: All / My routes filter, route cards, Create route button | Filters work; list paginated; Create route opens drawer or login redirect |
| UAT-U7 | Panel collapse to icon strip | Collapse → narrow strip; expand → full panel |
| UAT-U8 | Route card hover/select highlights route on map | Hover or tap route card → that route's photos highlighted, others faded |
| UAT-U9 | Route card click opens route in bottom drawer | Click route → drawer with route gallery and metadata; map shows route |
| UAT-U10 | Create route only from panel; drawer with create flow | Create route button in panel only; drawer has upload, place, reorder, submit |
| UAT-U11 | My routes only as filter in panel; no /routes/me | No My routes in menu; /routes/me route removed; My routes only in Routes panel filter |
| UAT-U12 | Touch and accessibility | Tap route card highlights; pins and cards have adequate hit targets; Escape and focus behaviour |

---

## Git Workflow

- **Branch:** `feat/v6-ui-overhaul` (single branch) or one branch per phase (e.g. `feat/v6-phase-1`).
- **Commits:** One commit per step; message format `type(scope): description` (e.g. `feat(frontend): redirect / to /browse`).
- **PR:** Merge after all phases complete and tests pass, or merge by phase if preferred. Phase 0 (backend) may be on a separate branch and merged first so the frontend can consume the photos endpoint in Phase 3.

---

## Agent Quick Reference

1. **Read** PRD v6 and USER_FLOWS.md and the step's Agent Instructions.
2. **Implement** only what is specified; do not add additional user flows (filter/sort, search, share, save, offline).
3. **Preserve** existing API usage, auth, and map behaviour except where explicitly changed.
4. **Update tests** for new layout and entry points; keep mocks where appropriate.
5. **Verify** Definition of Done before committing.

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-21
