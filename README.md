# Photowalker

A web application for creating, sharing, and discovering photowalk routes with geolocated photos.

## Overview

Photowalker enables photographers to create curated routes on a map, attach geolocated photos to those routes, and share them with the community. Each photowalk combines a route (LineString geometry) with photos (Point geometries) and narrative, creating a "living object" that captures how a place looked when walked.

## Documentation

- **[Product Requirements Document (PRD v2)](./Design/PRD_v2.md)** - Complete specification including database design, project structure, API contracts, and requirements.
- **[Implementation Roadmap](./Design/IMPLEMENTATION_ROADMAP.md)** - Phased implementation plan with committable steps, unit tests, and UAT.
- **[Project Proposal](./Design/PROJECT_PROPOSAL.md)** - Non-technical project overview.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for local PostgreSQL + Redis)

### Backend

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Development Environment

Start PostgreSQL (with PostGIS) and Redis:

```bash
docker-compose up -d
```

Verify PostGIS: `docker-compose exec postgres psql -U photowalker -d photowalker -c "SELECT PostGIS_Version();"`

Configure environment:

- `backend/`: Copy `.env.example` to `.env` and fill in values
- `frontend/`: Copy `.env.example` to `.env.local` and set `VITE_API_URL`

See [Step 0.2: Development Environment](./Design/IMPLEMENTATION_ROADMAP.md#step-02-development-environment) for details.

## Project Structure

```
photowalker-app/
├── backend/          # FastAPI backend (Python)
├── frontend/         # React frontend (TypeScript)
├── shared/           # Shared contracts (OpenAPI spec)
├── Design/           # PRD, roadmap, proposal
└── README.md         # This file
```

See [PRD v2](./Design/PRD_v2.md) for detailed project structure.

## Tech Stack

- **Backend:** FastAPI, PostgreSQL + PostGIS, SQLAlchemy, Alembic
- **Frontend:** React, TypeScript, MapLibre GL JS, Mapbox GL Draw, Turf.js
- **Storage:** AWS S3 (or compatible)
- **Auth:** Google OAuth 2.0

See [PRD v2](./Design/PRD_v2.md) for complete technology stack details.

## Status

**Current Phase:** Phase 0 Complete (Project Foundation)  
**Next Phase:** Phase 1 - Backend Foundation (Step 1.1: Core Application Setup)

## License

TBD
