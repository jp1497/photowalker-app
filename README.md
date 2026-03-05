# Photowalker

A web application for creating, sharing, and discovering photowalk routes with geolocated photos.

## Purpose

Photowalker solves the gap between route planning and photo sharing for photographers. There is no dedicated platform that combines geolocated photos, curated routes, and community discovery. Photowalker enables photographers to create routes on a map, attach photos with automatic location extraction, and share discoverable photowalks with the community.

## Vision

- **Target users:** Photographers who participate in or organize photowalks (street, landscape, urban, enthusiasts); anyone interested in discovering routes and visual stories
- **Core value:** Each photowalk is a "living object"—a curated route plus photos and narrative—that captures how a place looked when walked
- **Differentiators:** Geographic focus, route-centric design, photo reuse across routes, community discovery by place

See [Project Proposal](Design/PROJECT_PROPOSAL.md) for the full vision and scope.

## Quick Start

**Prerequisites:** Python 3.11+, Node.js 20+, Docker

```bash
make dev-infra      # Start Postgres, Redis, backend, worker (from project root)
make dev-backend    # Terminal 1: backend with hot reload
make dev-frontend   # Terminal 2: frontend dev server
```

The API runs at http://localhost:8000; frontend at http://localhost:5173 (Vite default).

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full setup, environment config, and make targets.

## Project Structure

```
photowalker-app/
├── backend/          # FastAPI backend (Python)
├── frontend/         # React frontend (TypeScript)
├── shared/           # Shared contracts (OpenAPI spec)
├── Design/           # PRD, roadmap, proposal
└── docs/             # Development, deployment, troubleshooting
```

## Documentation

- [Development setup](docs/DEVELOPMENT.md) - Full local setup, make commands, tests
- [Deployment](docs/DEPLOYMENT.md) - Docker, production, migrations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues
- [Contributing](CONTRIBUTING.md) - Workflow, branching, PR process
- [Design docs](Design/) - PRD v2, Implementation Roadmap, Project Proposal

## API

When the backend runs: http://localhost:8000/docs (Swagger), http://localhost:8000/redoc (ReDoc). Static reference: [shared/openapi.yaml](shared/openapi.yaml).

## Tech Stack

FastAPI, PostgreSQL + PostGIS, React, TypeScript, MapLibre GL JS, AWS S3, Google OAuth. See [PRD v2](Design/PRD_v2.md) for details.

## Status

Phase 7 - Integration & Polish (complete). See [Implementation Roadmap](Design/IMPLEMENTATION_ROADMAP.md).

## License

TBD
