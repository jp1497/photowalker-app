# Photowalker: Project Proposal

> **Superseded by [PRD.md](./PRD.md)** — This document is retained for historical context. The PRD is the single source of truth.

---

## The Problem

Instagram has become less engaging for photographers. The real community in photography is found in photowalks—organized walks where photographers explore locations together and share stories through pictures. However, there's no dedicated platform that combines route planning, geolocated photos, and community discovery in one place.

## The Solution

Photowalker is a web application that enables photographers to create, share, and discover photowalk routes with geolocated photos. Think of it as combining the route planning of a hiking app with the photo sharing of Instagram, specifically designed for photographers.

**Core Concept:** Each photowalk is a "living object" that combines:
- A curated route (the path walked)
- Photos taken at specific locations along that route
- Narrative and context

It answers the question: "Here's a path through a place, and here's how it looked when I walked it."

---

## Target Users

**Primary Users:** Photographers who participate in or organize photowalks
- Street photographers
- Landscape photographers
- Urban explorers
- Photography enthusiasts

**Secondary Users:** Anyone interested in discovering interesting routes and visual stories

---

## Core Features (MVP)

### 1. User Authentication
- Sign in with Google account (one-click login)
- No complex profiles—just name and avatar

### 2. Create Photowalk Routes
- Draw a route directly on an interactive map
- Add a title and description
- Tag routes with keywords (e.g., "urban," "sunset," "architecture")
- Routes are private by default, can be made public
- Each route gets a shareable web link

### 3. Upload and Attach Photos
- Upload photos from computer
- System automatically extracts location from photo metadata (GPS)
- Photos appear as pins on the map at their exact location
- Add captions to photos
- Associate photos with one or more routes (photos can appear in multiple routes)

### 4. View Shared Routes
- Public routes accessible via shareable link
- Interactive map showing the route path and photo locations
- Click photo pins to view photos
- Photo gallery with captions
- Route details: title, description, author, distance, tags

### 5. Discover Routes
- Browse public routes on a map
- Filter by location (zoom/pan to see routes in that area)
- Filter by tags
- View routes in list or map format

---

## What Makes This Different

1. **Geographic Focus:** Routes and photos are tied to real-world locations, enabling discovery by place
2. **Route-Centric:** Unlike Instagram (photo-centric) or Strava (activity-centric), Photowalker centers on the route as the primary object
3. **Photo Reuse:** Photos can belong to multiple routes, enabling creative storytelling
4. **Community Discovery:** Public routes create a discoverable library of photowalk experiences

---

## Technical Approach (Simplified)

**Backend:** Modern web API built with Python (FastAPI framework)
- Handles user accounts, routes, photos, and search
- Stores route paths and photo locations using geographic database
- Stores photos in cloud storage (AWS S3)

**Frontend:** Interactive web application built with React
- Interactive maps for drawing and viewing routes
- Photo upload and gallery interfaces
- Responsive design for desktop and mobile browsers

**Key Technologies:**
- Geographic database (PostGIS) for efficient location-based queries
- Cloud storage for photos
- Google OAuth for secure login

---

## Success Metrics

**User Engagement:**
- Number of routes created
- Number of photos uploaded
- Number of route views
- Average photos per route

**Platform Health:**
- User retention (users who create multiple routes)
- Route discovery (routes viewed by others)
- Geographic coverage (routes across different locations)

---

## Project Scope

### Included in MVP
- Google OAuth login
- Route creation with map drawing
- Photo upload with automatic location extraction
- Public route sharing
- Route browsing and discovery
- Basic tagging system

### Not Included (Future Enhancements)
- Mobile apps (web-only for MVP)
- Social features (comments, likes, follows)
- Photo editing tools
- Route templates or auto-generation
- Offline mode
- Video support
- Advanced search

---

## Business Model (Future Consideration)

**Potential Revenue Streams:**
- Freemium model (premium features for power users)
- Sponsored routes or featured placements
- Partnerships with photography equipment brands
- API access for third-party developers

**Note:** MVP focuses on building the core product and community. Monetization strategies will be explored after validating product-market fit.

---

## Development Phases

### Phase 1: MVP Development
- Build core features: authentication, route creation, photo upload, route viewing, browsing
- Establish technical infrastructure
- Launch private beta with small group of photographers

### Phase 2: Community Building
- Gather user feedback
- Refine user experience
- Grow user base organically
- Monitor engagement metrics

### Phase 3: Enhancement (Post-MVP)
- Add requested features based on user feedback
- Improve discovery algorithms
- Consider mobile apps
- Explore monetization options

---

## Key Constraints and Assumptions

**Technical Constraints:**
- Photos must have GPS metadata (EXIF data) to be uploaded
- JPEG format only for MVP
- Maximum 50 photos per route
- Maximum 10MB per photo file

**Business Assumptions:**
- Photographers want to share routes and discover new locations
- Community will create valuable content organically
- Geographic discovery is a key differentiator
- Web-first approach is sufficient for initial launch

---

## Risks and Mitigations

**Risk:** Low initial user adoption
- **Mitigation:** Focus on quality over quantity, engage with photography communities early

**Risk:** Photos without GPS metadata
- **Mitigation:** Clear messaging that GPS is required; future enhancement could allow manual pin placement

**Risk:** Storage costs scaling with photo uploads
- **Mitigation:** Set reasonable limits per user; optimize image storage and thumbnails

**Risk:** Route quality varies widely
- **Mitigation:** Allow private routes by default; public routes can be curated/featured later

---

## Success Criteria

The MVP will be considered successful if:
1. Users can successfully create and share photowalk routes
2. Photos are correctly geolocated and displayed on maps
3. Public routes are discoverable through browsing
4. Core user flow (create → upload → share → view) works smoothly
5. Initial user feedback is positive

---

## Next Steps

1. **Review and Approve:** Review this proposal and technical PRD
2. **Development Kickoff:** Begin implementation of MVP features
3. **Beta Testing:** Launch private beta with select photographers
4. **Iterate:** Gather feedback and refine
5. **Public Launch:** Open to broader photography community

---

## Related Documents

- **[Product Requirements Document (PRD)](./PRD.md)** - Complete technical specification
- **[README](./README.md)** - Project overview and quick start

---

**Document Purpose:** This proposal serves as a non-technical reference for stakeholders, investors, or team members who need to understand the project goals, features, and scope without diving into technical implementation details.
