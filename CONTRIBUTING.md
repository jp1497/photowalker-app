# Contributing to Photowalker

## Design Authority

- **[PRD v2](Design/PRD_v2.md)** - Product requirements, database design, API specification, infrastructure
- **[Implementation Roadmap](Design/IMPLEMENTATION_ROADMAP.md)** - Phased implementation plan, steps, tests, UAT

When implementing features, reference the roadmap step's Agent Instructions and Design Constraints. Do not add features outside the specified scope without design approval.

## Development Workflow

1. Create a branch per phase: `feat/<phase-name>` (e.g. `feat/auth`, `feat/routes`)
2. One commit per roadmap step; message format: `type(scope): description`
3. Submit a PR when all steps in the phase are complete and tests pass
4. Merge `feat/<phase>` into `main` after review

## Local Setup

See [README - Quick Start](README.md#quick-start) and [README - Development Environment](README.md#development-environment).

- Backend: Python 3.11+, `uvicorn app.main:app --reload`
- Frontend: Node.js 20+, `npm run dev`
- Infrastructure: `docker compose up -d` (Postgres, Redis, backend, worker)

## Running Tests

- **Backend:** `cd backend && pytest`
- **Frontend:** `cd frontend && npm run test`
- **E2E:** `cd frontend && npm run test:e2e` (requires local stack: `docker compose up -d`)

## API Documentation

- **Live (development):** `http://localhost:8000/docs` (Swagger), `http://localhost:8000/redoc`
- **OpenAPI spec:** `shared/openapi.yaml` (manual reference); canonical spec at `/openapi.json` when backend runs

## UAT Scenarios

User acceptance scenarios are defined in the [Implementation Roadmap - UAT Master Checklist](Design/IMPLEMENTATION_ROADMAP.md#uat-master-checklist):

| ID | User Story |
|----|------------|
| UAT-FR1 | Sign in with Google OAuth |
| UAT-FR2 | Create a photowalk route |
| UAT-FR3 | Upload photos and attach to routes |
| UAT-FR4 | View a shared route |
| UAT-FR5 | Browse public routes |

Each phase's steps include UAT criteria. Verify UAT passes before marking a phase complete.
