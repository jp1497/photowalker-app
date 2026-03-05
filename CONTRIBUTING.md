# Contributing to Photowalker

Thanks for your interest in contributing. This guide covers setup, workflow, and expectations.

## First-Time Setup

1. **Prerequisites:** Python 3.11+, Node.js 20+, Docker
2. **Infrastructure:** `make dev-infra` (from project root)
3. **Backend:** `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
4. **Frontend:** `cd frontend && npm install`
5. **Environment:** Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`; fill in required values
6. **Run:** `make dev-backend` (terminal 1), `make dev-frontend` (terminal 2)

For full details, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). If you hit issues, check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Design Authority

- **[design/PRD.md](design/PRD.md)** - Product requirements, user flows, technical specification, UAT verification (single source of truth)

When implementing features, reference the PRD for requirements and acceptance criteria. Do not add features outside the specified scope without design approval. If a technical constraint requires a design change, document the proposed change and seek approval before implementing alternatives.

## Branching

- Create a branch per phase: `feat/<phase-name>` (e.g. `feat/auth`, `feat/routes`)
- One commit per roadmap step
- Commit message format: `type(scope): description` (e.g. `feat(routes): add route creation endpoint`)

## Pull Request Process

1. Ensure all steps in the phase are complete and tests pass
2. Submit a PR from `feat/<phase>` into `main`
3. Include a brief description of changes and any relevant UAT IDs
4. Respond to review feedback
5. Merge after approval

## Testing

Run tests before opening a PR. Each suite covers different layers:

- **Backend:** `cd backend && pytest` or `make test` – unit and integration tests (requires Postgres)
- **Frontend:** `cd frontend && npm run test` or `make test` – Vitest unit tests
- **E2E:** `cd frontend && npm run test:e2e` or `make test-e2e` – Playwright; requires infra and backend running

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full test instructions.

## Code Style

- **Backend:** Use Ruff/Flake8 and MyPy per project config
- **Frontend:** Use ESLint per project config

Lint and fix before committing. CI runs these checks.

## Local Setup (Quick Reference)

- **Backend:** `make dev-backend` or `cd backend && .venv/bin/uvicorn app.main:app --reload`
- **Frontend:** `make dev-frontend` or `cd frontend && npm run dev`
- **Infrastructure:** `make dev-infra` or `docker compose up -d`

## API Documentation

- **Live (development):** http://localhost:8000/docs (Swagger), http://localhost:8000/redoc
- **OpenAPI spec:** [shared/openapi.yaml](shared/openapi.yaml) (static reference); canonical spec at `/openapi.json` when backend runs

## Getting Help

Open an issue for questions, bugs, or design proposals. Reference the PRD or roadmap where relevant.

## UAT Scenarios

User acceptance criteria and manual verification are defined in [design/PRD.md - UAT Verification](design/PRD.md#10-uat-verification). Verify UAT passes before release.
