# UAT Checklist — v6 User Flows

Manual verification checklist for the PRD v6 UI overhaul. Use for sign-off before release.

**Reference:** [IMPLEMENTATION_ROADMAP_V6.md](./IMPLEMENTATION_ROADMAP_V6.md) Phase 8 Step 8.2.

| ID | Requirement | Verification | Pass |
|----|-------------|--------------|------|
| UAT-U1 | Root redirects to browse | Navigate to `/` → redirect to `/browse` | |
| UAT-U2 | Welcome modal on browse when not signed in | Not signed in → modal with Browse the map, Create account; dismiss → not shown again in session | |
| UAT-U3 | Account in top-right only; Sign in, Settings, Sign out | No My routes or Create route in account dropdown | |
| UAT-U4 | Nav: Browse, Routes | Nav rail shows only Browse and Routes; Browse → /browse; Routes → panel opens | |
| UAT-U5 | Browse default: photo pins only; click → PhotoGallery lightbox | No route list on browse; pin click opens PhotoGallery lightbox | |
| UAT-U6 | Explore panel: All / My routes filter, route cards, Create route button | Filters work; list paginated; Create route opens drawer or login redirect | |
| UAT-U7 | Panel collapse to icon strip | Collapse → narrow strip; expand → full panel | |
| UAT-U8 | Route card hover/select highlights route on map | Hover or tap route card → that route's photos highlighted, others faded | |
| UAT-U9 | Route card click opens route in bottom drawer | Click route → drawer with route gallery and metadata; map shows route | |
| UAT-U10 | Create route only from panel; drawer with create flow | Create route button in panel only; drawer has upload, place, reorder, submit | |
| UAT-U11 | My routes only as filter in panel; no /routes/me | No My routes in menu; /routes/me redirects to /browse; My routes only in Routes panel filter | |
| UAT-U12 | Touch and accessibility | Tap route card highlights; pins and cards have adequate hit targets; Escape and focus behaviour | |

**Sign-off:** _________________________ Date: ___________
