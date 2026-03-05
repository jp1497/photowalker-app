# Deployment

Guide for deploying Photowalker using Docker. See [design/PRD.md](../design/PRD.md) for the product specification.

## Docker Quick Start

Build and run the full stack (Postgres, Redis, backend API, thumbnail worker) from the **project root**:

```bash
# Ensure backend/.env exists (copy from backend/.env.example and configure)
docker compose up -d
```

The API listens on http://localhost:8000. Health check: http://localhost:8000/health

## Make Target

```bash
make migrate   # Run database migrations (requires backend container up)
```

Equivalent raw command:

```bash
docker compose exec backend alembic upgrade head
```

Alembic is included in the backend image. Ensure `DATABASE_URL` in the container points at the Postgres service (`postgres:5432` when using docker-compose).

## Build Backend Image Only

```bash
docker build -t photowalker-api ./backend
docker run -p 8000:8000 --env-file backend/.env photowalker-api
```

For a standalone run, set `DATABASE_URL` and `REDIS_URL` to point at your Postgres and Redis instances.

## Production

Use the production override for restart policies and production environment:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Checklist

Before deploying to production:

1. Set `ENVIRONMENT=production`, `DEBUG=false` in `backend/.env`
2. Use a strong `SECRET_KEY` (e.g. `openssl rand -hex 32`)
3. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` for your production domain
4. Configure S3 (or compatible) credentials and bucket
5. Set `FRONTEND_URL` to your frontend origin for CORS
6. Run migrations: `make migrate` or `docker compose exec backend alembic upgrade head`
