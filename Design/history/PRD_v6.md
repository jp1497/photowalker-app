# Photowalker Product Requirements Document — UI Overhaul for User Flows (v6)

**Version:** 6.0  
**Date:** 2026-02-21  
**Status:** Specification  
**Previous Version:** [PRD v5](./PRD_v5.md) (Map Basemap Styling)  
**Scope:** Frontend UI/UX changes required to implement the user flows defined in [USER_FLOWS.md](./USER_FLOWS.md). Backend changes only where explicitly required for photo-level browse.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Objectives and Success Criteria](#objectives-and-success-criteria)
3. [Current State](#current-state)
4. [Target Design](#target-design)
5. [Requirements](#requirements)
6. [Impact Surface](#impact-surface)
7. [Backend Considerations](#backend-considerations)
8. [Out of Scope](#out-of-scope)
9. [References](#references)

---

## Executive Summary

This PRD defines the **application changes** required to implement the user flows in [design/USER_FLOWS.md](./USER_FLOWS.md). Those flows specify: (1) land on browse with welcome when not signed in; (2) default browse = photos-only on the map with lightbox; (3) routes accessible via a menu bar that opens a left collapsible Explore routes panel; (4) My routes as a filter in that panel and Create route as a button in that panel; (5) route view and create route as a shared bottom drawer under the map; (6) account as a top-right circular user icon with Sign in / Settings / Sign out only.

**Design principle:** Implement the flows in USER_FLOWS.md with shared components (bottom drawer, collapsible left panel) and layout that can later be adapted to mobile without redefining flows.

**Relationship to prior PRDs:** v4 introduced map-first layout and overlays; v5 addressed basemap styling. This v6 PRD is limited to the UI/UX changes that realise the new user flows (landing, photos-only browse, menu bar, Explore routes panel, bottom drawer, account placement). It does not add the "additional user flows" or mobile-specific behaviour from USER_FLOWS.md (those remain suggested for later).

---

## Objectives and Success Criteria

1. **Landing and welcome** — Root (`/`) redirects to `/browse`. Unauthenticated users see a dismissible welcome popup on the browse page with "Browse the map" and "Create account" (and optionally "Maybe later").
2. **Photos-only default browse** — The default view on browse is photo pins on the map (centred on user location); click opens a lightbox with photo title, user, and routes. Routes are not the default; they are reached via the menu bar.
3. **Menu bar and Explore routes panel** — A menu bar (e.g. top-left or integrated) provides an entry to open the **Explore routes** left collapsible panel. The panel contains: My routes filter (when signed in), route cards (thumbnail + summary, paginated), Create route button. Hover/select on a route card highlights that route’s photos on the map and fades the rest. Panel can collapse to an icon strip.
4. **Bottom drawer for route view and create** — Viewing a route and creating a route use the same **bottom drawer** component under the map (peek + expanded, scrollable content). Route view shows gallery (images + text, default sequential); create shows upload, confirm locations, adjust order, add title/description.
5. **Account placement** — Account and admin are accessed via a **top-right circular user icon** only. Dropdown contains Sign in (if guest), Settings, Sign out. My routes and Create route are not in the account menu.
6. **Mobile-ready design** — Components and layout are structured so that the same flows can later be converted to mobile (e.g. panel → full-width overlay or bottom sheet, touch targets) without redefining behaviour.

---

## Current State

- **Routing:** [App.tsx](../frontend/src/App.tsx) — `/` renders Home; `/browse` renders Browse; `/routes/me`, `/routes/create`, `/routes/:slug`, `/login` under MapShellLayout. No redirect from `/` to `/browse`.
- **Navigation:** [AppMenu.tsx](../frontend/src/components/common/AppMenu.tsx) — **Top-left** "Menu" button; menu includes Home, Browse, My routes, Create route, Sign in/out. Not a top-right user circle; My routes and Create route are in the menu.
- **Browse:** [Browse.tsx](../frontend/src/pages/Browse.tsx) — Map shows **route-level** clusters/pins (no individual photo pins). "Routes" button opens a **modal overlay** (list), not a persistent left collapsible panel. No hover/select to highlight one route on the map.
- **Route detail:** [RouteDetail.tsx](../frontend/src/pages/RouteDetail.tsx) — **Closable panel over the map** (not a bottom drawer). [PhotoGallery](../frontend/src/components/photos/PhotoGallery.tsx) provides lightbox inside that panel.
- **Create route:** [CreateRouteFromPhotos.tsx](../frontend/src/pages/CreateRouteFromPhotos.tsx) — Drawer over map; entry from menu or protected route. Not triggered from an Explore routes panel.
- **My routes:** Dedicated route `/routes/me` and protected page; not a filter inside a shared Explore panel.
- **No shared** bottom-drawer or collapsible-panel component; each page implements its own overlay.

---

## Target Design

### Routing and landing

- **Redirect:** `/` redirects to `/browse` (e.g. `<Navigate to="/browse" replace />` or equivalent). Home as a separate page is removed or repurposed (welcome content moves to Browse).
- **Welcome:** When the user is not authenticated, the browse page shows a dismissible welcome modal (title, short copy, "Browse the map", "Create account", optionally "Maybe later"). Dismissal is persisted (e.g. sessionStorage or local storage) so it does not reappear in the same session.

### Browse page (default: photos-only)

- **Map:** Displays **photo pins** in the current viewport (bbox), centred on user location when available. No route clusters as the default.
- **Photo click:** Opens a **lightbox** (modal or overlay) showing the photo, title, user, and routes that contain this photo. Lightbox is reusable (e.g. same component as or consistent with PhotoGallery lightbox).
- **Routes:** Not shown by default. Access to the route list and filters is via the **menu bar** (see below).

### Menu bar and Explore routes panel

- **Menu bar:** A minimal bar or control (e.g. top-left) that includes at least an entry to open **Explore routes** (e.g. "Explore routes" or icon). It does not duplicate My routes or Create route as top-level menu items; those live inside the Explore panel.
- **Explore routes panel:** A **left collapsible panel** (drawer or slide-out). When expanded it shows:
  - **Filters:** "All" and "My routes" (when signed in). Optional: tag filter or sort chips (can be deferred to a later phase per USER_FLOWS).
  - **Route cards:** Paginated list of route cards (thumbnail + summary). Click navigates to route (opens bottom drawer). **Hover or select** updates the map to **highlight that route’s photos** and **fade** other photos.
  - **Create route button:** Primary CTA in the panel; opens the create-route bottom drawer (protected; redirect to login if not authenticated).
  - **Collapse:** Panel can collapse to an **icon strip** (e.g. narrow bar with icon only) so the map gains space; expand again to show full list.
- **Panel state and URL:** Panel open/closed and selected route can be reflected in URL or local state so that "Explore routes" from menu opens the panel; selecting a route can set route slug and open the bottom drawer.

### Bottom drawer (route view and create)

- **Shared component:** A single **BottomDrawer** (or equivalent) component used for both (a) viewing a route (gallery + metadata) and (b) creating a route (upload, locations, order, details).
- **Behaviour:** Renders **under the map** (anchored to bottom). Supports at least: **peek state** (e.g. one line or thumbnail visible) and **expanded state** (scrollable content). Avoid fixed pixel heights that would prevent future drag-handle or full-height expand on mobile.
- **Route view content:** Title, metadata, and gallery (images + text, default sequential). Existing PhotoGallery and RouteView metadata can be composed inside the drawer. "Edit location" and "Add photos" (owner) remain available within the drawer flow.
- **Create route content:** Existing steps: upload photos, place on map (MapPicker where needed), reorder, route title/description. Same drawer shell as route view.

### Account

- **Position:** **Top-right** of the viewport.
- **Control:** A **circular user icon** (avatar when signed in, placeholder/guest icon when not). Click opens a dropdown.
- **Dropdown contents:** **Sign in** (if not authenticated), **Settings**, **Sign out** (if authenticated). No "My routes" or "Create route" links; those are only in the Explore routes panel.

### Map state and layers

- **Browse (photos-only):** Map has a single "browse photos" mode: photo pins in bbox, optional clustering for density. One selected photo can drive lightbox.
- **Explore routes panel open:** When a route card is hovered or selected, the map shows that route’s photos **highlighted** (e.g. full opacity) and other photos **faded** (e.g. reduced opacity or dimmed). When no route is selected, show all photos (or all route start points) per product choice.
- **Route view / create:** When the bottom drawer is open for a specific route (or create), the map shows the route polyline and photo pins for that route (or create preview). Existing MapShell mode (browse | detail | create) and layer logic can be extended to support "browse photos" and "explore route highlight" states.

---

## Requirements

### FR-U1: Redirect root to browse and welcome on browse

**User Story:** As a user, I land on the browse page when I open the app; if I am not signed in, I see a one-time welcome popup.

**Acceptance Criteria:**

- Navigating to `/` results in a redirect to `/browse` (replace in history).
- On `/browse`, when the user is not authenticated, a dismissible welcome modal is shown (unless already dismissed in this session). Modal includes: short app description, "Browse the map" and "Create account" as primary actions, and optionally "Maybe later" to dismiss.
- Dismissal is persisted (e.g. sessionStorage key such as `photowalker_welcome_dismissed`) so the modal does not reappear on subsequent loads in the same session (or until cleared).
- Authenticated users do not see the welcome modal on browse.

### FR-U2: Photos-only default browse and photo lightbox

**User Story:** As a user, I see photo pins on the map by default and can open a photo in a lightbox with its details.

**Acceptance Criteria:**

- The default browse view shows **photo pins** on the map for photos in the current viewport (bbox), centred on user location when available (e.g. via geolocation or usePreferredMapCenter).
- Clicking a photo pin opens a **lightbox** (modal or overlay) that displays: the photo image, title (or caption), uploader (user), and the list of routes that contain this photo (with links to open that route).
- The lightbox can be closed (e.g. backdrop click, Escape, close button). Closing returns focus to the map.
- No route-level clusters or route list are shown by default on the map; routes are accessed via the Explore routes panel (FR-U3).

### FR-U3: Menu bar and Explore routes left panel

**User Story:** As a user, I open the Explore routes panel from the menu bar and see route cards, My routes filter, and a Create route button; selecting a route highlights it on the map.

**Acceptance Criteria:**

- A **menu bar** (or equivalent) includes an entry to open **Explore routes** (e.g. "Explore routes" or icon). Opening it shows a **left collapsible panel**.
- The panel displays a **paginated list of route cards** (thumbnail, title, summary snippet). Route list data comes from the existing browse API (e.g. GET /v1/routes with bbox/tags/author_id). When the user is authenticated, a **My routes** filter is available (e.g. "All" | "My routes"); "My routes" filters by current user (author_id).
- A **Create route** button is present in the panel. Clicking it opens the create-route bottom drawer; if the user is not authenticated, the app redirects to login with return URL.
- **Hover or select** on a route card updates the map so that **that route’s photos are highlighted** (e.g. full opacity) and **other photos are faded** (e.g. reduced opacity). When no card is selected, the map shows the default photo view (all photos in bbox) or a neutral state.
- The panel can **collapse** to a narrow strip (e.g. icon only). Expanding again shows the full list. Collapse state is retained during the session (e.g. state or URL).
- The panel does not replace the map: it overlays or sits beside it (left side), leaving the map visible.

### FR-U4: Bottom drawer for route view and create

**User Story:** As a user, when I open a route or start creating a route, I see a bottom drawer under the map with the gallery or create form.

**Acceptance Criteria:**

- **Viewing a route:** Selecting a route (from the Explore panel or from the map when in a route-highlight mode) opens a **bottom drawer** under the map. The drawer shows route title, metadata (distance, date, tags, etc.), and a **scrollable gallery** of images and text in sequence (default order). Existing PhotoGallery and metadata components are reused inside the drawer. Owner actions (edit location, add photos) remain available within the drawer.
- **Creating a route:** Clicking "Create route" in the Explore panel opens the same **bottom drawer** pattern. Content is the existing create flow: upload photos, confirm locations (map picker where needed), reorder, add title/description. Submit calls POST /v1/routes/from-photos as today.
- **Shared component:** Both flows use the same bottom-drawer component (e.g. `BottomDrawer`) so that layout, peek/expand behaviour, and accessibility are consistent. The drawer is anchored to the bottom of the viewport and does not cover the entire map (peek state allows a strip of map to remain visible).
- **Peek and expand:** The drawer supports at least a peek state (e.g. title bar or one line visible) and an expanded state (scrollable body). Implementation may use fixed heights or percentages; the design should avoid hard-coded heights that would prevent a future drag handle or full-height expand on mobile.

### FR-U5: Account in top-right only

**User Story:** As a user, I access sign in, settings, and sign out from a circular user icon in the top-right.

**Acceptance Criteria:**

- The **account** control is a **circular user icon** (avatar when authenticated, generic/user icon when not) positioned in the **top-right** of the viewport (with appropriate offset so it is not clipped).
- Clicking the icon opens a **dropdown** (or popover) containing: **Sign in** (when not authenticated), **Settings**, **Sign out** (when authenticated). The dropdown does **not** include "My routes" or "Create route"; those are only in the Explore routes panel.
- The previous top-left "Menu" that contained Home, Browse, My routes, Create route, Sign in/out is replaced or refactored so that: (a) Explore routes is the primary menu entry that opens the left panel, and (b) account is only the top-right icon with the above items.
- Sign in continues to use the existing Google OAuth flow; after login, redirect to the stored return URL or `/browse`.

### FR-U6: My routes as filter only; no dedicated /routes/me page

**User Story:** As a user, I see "My routes" as a filter in the Explore routes panel, not as a separate menu item or page.

**Acceptance Criteria:**

- There is no standalone **My routes** item in the main app menu (or account menu). The only way to see "My routes" is inside the **Explore routes** panel as a filter (e.g. "All" | "My routes").
- The route `/routes/me` may be retained for deep-linking (e.g. "open Explore panel with My routes filter selected") or removed; if retained, it should open the browse map with the Explore panel open and My routes filter applied, rather than a separate full-page list.
- Protected route behaviour: if the user is not authenticated and tries to apply "My routes" or open a create flow, redirect to login with return URL as today.

### FR-U7: Mobile-ready structure

**User Story:** As a developer, the new layout and components are structured so they can be adapted to mobile later without redefining user flows.

**Acceptance Criteria:**

- The **left panel** (Explore routes) is implemented so that its open/closed and collapse state can later be driven by viewport (e.g. on small screens, "open" could mean full-width overlay or bottom sheet). No hard dependency on desktop-only layout in the component contract.
- The **bottom drawer** uses a single component with clear peek/expand semantics and no fixed pixel height that would block a future drag handle or full-height expand.
- **Touch:** Route card "highlight on map" uses **selection** (click/tap) as well as hover where applicable, so that touch devices can highlight by tapping. Photo pins and route cards have a minimum touch target size (e.g. 44px) or are wrapped in a hit area that meets accessibility guidelines.

---

## Impact Surface

### Routing and app shell

- **App.tsx** — Add redirect from `/` to `/browse`. Remove or repurpose `Home` route; move welcome content into Browse or a shared welcome modal used on Browse. MapShellLayout continues to wrap `/browse`, `/routes/create`, `/routes/:slug`; adjust for `/routes/me` if it becomes a redirect to browse + Explore panel + My routes filter.
- **AppMenu.tsx** — Replace with or add: (1) **Menu bar** entry for "Explore routes" (opens left panel). (2) **Top-right account**: circular user icon that opens dropdown (Sign in, Settings, Sign out only). Remove My routes and Create route from the main/account menu. Consider renaming or splitting into `MenuBar` (left) and `AccountMenu` (top-right) components.

### Pages

- **Browse** — Becomes the **only** landing page (after redirect). Implement **photos-only** map: photo pins in bbox, click → lightbox (photo title, user, routes). Integrate **welcome modal** when unauthenticated (dismissible, persistence per FR-U1). Remove or relocate the current "Routes" button/list overlay; route list moves to the Explore routes panel.
- **Home** — Remove as a route or redirect to `/browse`; welcome content lives on Browse.
- **Explore routes panel** — New surface (can be a new component or page that renders inside the shell when "Explore routes" is open). Contains: filters (All, My routes when signed in), RouteList (or equivalent route cards), Create route button, collapse to icon strip. Panel state (open/collapsed, selected route) can be in React state or URL (e.g. query or path).
- **RouteDetail** — Refactored to render **inside the bottom drawer** when a route is selected (from panel or map). Map continues to show route polyline and photo pins via MapShell; detail content (metadata + PhotoGallery) moves into the drawer. Remove the current side panel overlay in favour of the shared BottomDrawer.
- **CreateRouteFromPhotos** — Refactored to render **inside the same bottom drawer** when "Create route" is triggered from the Explore panel. Flow (upload, place on map, reorder, submit) unchanged; only the container changes from current drawer to the shared BottomDrawer. Entry point is only from Explore panel (and protected route redirect if not logged in).
- **MyRoutes** — No longer a standalone page in the main menu. Either: (a) remove the `/routes/me` route and use "My routes" only as a filter in the Explore panel, or (b) keep `/routes/me` as a deep link that opens browse + Explore panel + My routes filter.

### New or shared components

- **BottomDrawer** — New shared component: bottom-anchored drawer with peek and expanded states, scrollable content area. Used by route view and create route. Props: open, onClose, children (route view content or create form), optional title/peek content.
- **ExploreRoutesPanel** — New component: left collapsible panel containing filters (All, My routes), route cards list (paginated), Create route button, collapse/expand control. Integrates with map context to set "highlighted route" for map layer behaviour.
- **PhotoLightbox** — Reusable lightbox for a single photo with title, user, and routes. May be extracted from or aligned with existing PhotoGallery lightbox behaviour. Used on browse when clicking a photo pin.
- **AccountIcon** — Top-right circular user icon with dropdown (Sign in, Settings, Sign out). Can be part of or replace the current AppMenu for the account portion.

### Map and data

- **MapShell / MapContext** — Extend to support: (1) **browse-photos** mode: show photo pins in bbox, one lightbox selection. (2) **explore-route-highlight** mode (when Explore panel has a route selected): show that route’s photos highlighted, others faded. (3) Existing **detail** and **create** modes for route view and create flow. Layer and source IDs must be coordinated so that browse photos, route highlight, and route detail do not conflict.
- **Browse page** — Fetches **photos** in viewport (or derives from routes). See [Backend Considerations](#backend-considerations). If backend provides photos-in-bbox, display them as pins; otherwise fall back to route-based pins with photo-level expansion where possible.
- **Explore panel** — Uses existing `getBrowseRoutes` (and optional author_id for My routes). Route cards click → set selected route slug and open bottom drawer; hover/select → set highlighted route id for map.

### Styles and layout

- **Layout** — Top bar or minimal chrome: left = menu (Explore routes); right = account icon. Map fills the remainder. Left panel overlays or sits in a column; bottom drawer overlays bottom. Ensure z-index ordering: map < panel < drawer < modals (lightbox, login).
- **CSS / theme** — No new design system required; reuse existing patterns. Ensure panel and drawer are structured for future responsive behaviour (e.g. panel width in rem or %, drawer height in % or max-height).

### Tests

- **Routing:** Tests that `/` redirects to `/browse`; that welcome appears on browse when not authenticated and is dismissible.
- **Browse:** Tests that default view shows photo pins (or stub); that clicking a pin opens lightbox with expected content.
- **Explore panel:** Tests that opening from menu shows panel with filters and route list; that My routes filter (when logged in) filters list; that Create route opens drawer; that selecting a route updates map highlight and opens bottom drawer.
- **Bottom drawer:** Tests that route view and create flow render inside the drawer; that peek/expand and close work.
- **Account:** Tests that account icon is top-right and dropdown contains only Sign in / Settings / Sign out; that Sign in triggers auth flow.
- **E2E:** Update any E2E that assumed Home at `/`, or My routes / Create route from main menu; update for new entry points.

---

## Backend Considerations

### Photo-level browse

The default browse view is **photos-only**: photo pins in the current viewport. Today the backend exposes:

- **GET /v1/routes** — bbox, tags, author_id, pagination. Returns routes with summary data (e.g. first_photo_id, route_geometry). It does not return per-photo locations for all photos in all routes in the bbox.

To implement photo pins for every photo in view, one of the following is required:

- **Option A — New endpoint:** Add **GET /v1/photos** (or similar) with query params such as `bbox`, `page`, `per_page`, returning photos that have a location within the bbox (with route ids and order for context). This is the cleanest for a photo-first browse.
- **Option B — Enrich route response:** Extend the browse-routes response to include, for each route, the list of photo locations (and ids) so the frontend can flatten them to photo pins. This may increase payload size and complexity.
- **Option C — Client-side aggregation:** Frontend fetches routes in bbox (existing API), then for each route fetches route detail (GET route by slug or id with photos) and plots photo locations. This can cause many requests and slower UX; not recommended unless bbox is small and route count is limited.

**Recommendation:** Implement **Option A** (new photos-in-bbox endpoint) in the backend if photo-level browse is to ship with good performance. If backend work is deferred, the frontend can implement a **temporary** route-based fallback: show route-level pins (as today) on browse, with click opening route detail in the bottom drawer; photo-level pins and lightbox can be added once the backend supports photos-in-bbox. The PRD assumes that either the new endpoint exists or the fallback is clearly documented and replaced when the API is available.

---

## Out of Scope

- **Additional user flows** from USER_FLOWS.md (filter/sort chips, search in panel, share route, save/bookmark, offline) — suggested for later; not part of this PRD.
- **Mobile-specific behaviour** (e.g. breakpoints, full-width panel on small screens) — only "design for easy conversion" is in scope (FR-U7).
- **Backend changes** other than optionally adding a photos-in-bbox (or equivalent) API as described above.
- **Design system or visual redesign** beyond what is needed to implement the flows (e.g. new typography or colour system).
- **Changes to PRD v3/v4/v5 feature set** (e.g. drafts, GPX, basemap styling) except where they are refactored to fit the new layout (e.g. route detail in drawer).

---

## References

- [design/USER_FLOWS.md](./USER_FLOWS.md) — Source of intended user flows for this PRD.
- [design/PRD_v4.md](./PRD_v4.md) — Map-first frontend overhaul (layout, overlays).
- [design/PRD_v5.md](./PRD_v5.md) — Map basemap styling (optional context).
- [frontend/src/App.tsx](../frontend/src/App.tsx) — Current routing and MapShellLayout.
- [frontend/src/components/common/AppMenu.tsx](../frontend/src/components/common/AppMenu.tsx) — Current menu (to be refactored into menu bar + account icon).
