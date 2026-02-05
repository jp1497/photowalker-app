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

Start PostgreSQL (with PostGIS) and Redis. Run from the **project root** (where `docker-compose.yml` lives):

```bash
# From project root (photowalker-app/)
docker compose up -d
```

If you see `Bind for 0.0.0.0:5432 failed: port is already allocated`, port 5432 is in use. Either stop the process using it (e.g. an existing Postgres container) or use an alternate host port (see [Troubleshooting](#troubleshooting) below).

Verify PostGIS: `docker compose exec postgres psql -U photowalker -d photowalker -c "SELECT PostGIS_Version();"`

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

## Troubleshooting

### Port 5432 already allocated

Docker reports `Bind for 0.0.0.0:5432 failed: port is already allocated` when something else is using PostgreSQL’s default port (often another container or a local Postgres install).

**Option A – Free port 5432 (recommended):**

1. List containers that might be using 5432:  
   `docker ps --format '{{.Names}} {{.Ports}}' | grep 5432`
2. Stop the photowalker stack (if it’s from a previous run):  
   `docker compose down`  
   (run from project root)
3. If you use another Postgres (e.g. Homebrew), stop it:  
   `brew services stop postgresql` (or equivalent).
4. Start the stack again:  
   `docker compose up -d` (from project root).

**Option B – Use a different host port:**

1. In `docker-compose.yml`, change the postgres `ports` to e.g. `"5433:5432"`.
2. In `backend/.env`, set `DATABASE_URL=postgresql+asyncpg://photowalker:photowalker@localhost:5433/photowalker`.
3. Run `docker compose up -d` from project root. The app will connect to Postgres on 5433.

### Platform warning (linux/amd64 vs arm64)

On Apple Silicon, you may see a warning that the PostGIS image is linux/amd64. The container still runs under emulation. To use an ARM image instead, set in `docker-compose.yml` under the postgres service:  
`platform: linux/arm64` (only if the image supports it; postgis/postgis may not publish arm64).

## License

TBD
