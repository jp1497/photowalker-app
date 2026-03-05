# Development Setup

Full guide for running Photowalker locally. For a minimal quick start, see the [README](../README.md).

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL + PostGIS, Redis)
- Git

## Step-by-Step Setup

### 1. Clone and Enter Project

```bash
cd photowalker-app
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Environment Configuration

**Backend:** Copy `backend/.env.example` to `backend/.env` and fill in values. Required variables include `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, Google OAuth credentials, and S3 config. See the example file for the full list.

**Frontend:** Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` (e.g. `http://localhost:8000`). The map uses [OpenFreeMap](https://openfreemap.org/) vector tiles (free, no API key required).

See the backend and frontend `.env.example` files for the full list of variables.

### 5. Start Infrastructure

From the **project root**:

```bash
make dev-infra
```

This runs `docker compose up -d` and starts Postgres (PostGIS), Redis, backend, and the thumbnail worker. For backend development with hot reload, run uvicorn locally and use the containerized Postgres/Redis. Stop the backend container to free port 8000:

```bash
docker compose stop backend
```

Verify PostGIS:

```bash
docker compose exec postgres psql -U photowalker -d photowalker -c "SELECT PostGIS_Version();"
```

### 6. Run the Stack

**Terminal 1 (backend):**

```bash
make dev-backend
```

**Terminal 2 (frontend):**

```bash
make dev-frontend
```

- API: http://localhost:8000
- Frontend: http://localhost:5173 (Vite default)

## Make Targets

Run `make help` or `make` from the project root for a summary.

| Target | Description |
|--------|-------------|
| `make dev-infra` | Start Docker stack (postgres, redis, backend, worker) |
| `make dev-backend` | Start backend with uvicorn hot reload (requires dev-infra) |
| `make dev-frontend` | Start frontend dev server |
| `make dev` | Start infra, then prompt to run dev-backend and dev-frontend in separate terminals |
| `make test` | Run backend pytest and frontend Vitest unit tests |
| `make test-e2e` | Run E2E tests (requires infra + backend running) |
| `make down` | Stop Docker stack |
| `make migrate` | Run database migrations |

**E2E note:** Ensure `docker compose` is up and the backend is running before E2E. Example: `make dev-infra && (make dev-backend &) && sleep 3 && make test-e2e`

## Running Tests

- **Backend:** `cd backend && pytest` (requires Postgres; CI uses `photowalker_test` DB)
- **Frontend:** `cd frontend && npm run test` (Vitest)
- **E2E:** `cd frontend && npm run test:e2e` (Playwright; requires infra and backend running)

Or use `make test` and `make test-e2e` from the project root.

## API Documentation

When the backend runs in development:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

Static reference: [shared/openapi.yaml](../shared/openapi.yaml). The live spec at `/openapi.json` when the app runs is canonical.

## Test and Development Data Cleanup

For information on where test and development data lives and how to clean it (database, S3, Redis), see [scripts/TEST_DATA_CLEANUP.md](../scripts/TEST_DATA_CLEANUP.md). Nothing is deleted automatically; you confirm each step.

## Troubleshooting

See [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues (e.g. port 5432 already allocated, Apple Silicon platform warnings).
