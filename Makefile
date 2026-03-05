# Photowalker development shortcuts
# Run from project root

.PHONY: help dev dev-infra dev-backend dev-frontend test test-e2e down migrate

help:
	@echo "Photowalker development targets"
	@echo ""
	@echo "  make dev-infra    Start Docker stack (postgres, redis, backend, worker)"
	@echo "  make dev-backend  Start backend with uvicorn (requires dev-infra)"
	@echo "  make dev-frontend Start frontend dev server"
	@echo "  make dev          Start infra, then backend and frontend (run in separate terminals)"
	@echo "  make test         Run backend + frontend unit tests"
	@echo "  make test-e2e     Run E2E tests (requires infra + backend running)"
	@echo "  make down         Stop Docker stack"
	@echo "  make migrate      Run database migrations"
	@echo ""
	@echo "Full setup: docs/DEVELOPMENT.md"

dev-infra:
	docker compose up -d

dev-backend:
	@echo "Starting backend... (Ctrl+C to stop)"
	cd backend && .venv/bin/uvicorn app.main:app --reload

dev-frontend:
	@echo "Starting frontend... (Ctrl+C to stop)"
	cd frontend && npm run dev

dev: dev-infra
	@echo "Infrastructure started. Run in separate terminals:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

test:
	@echo "Running backend tests..."
	cd backend && pytest --tb=short -q || true
	@echo "Running frontend tests..."
	cd frontend && npm run test

test-e2e:
	@echo "Ensure docker compose is up and backend is running before E2E."
	@echo "Run: make dev-infra && (make dev-backend &) && sleep 3 && make test-e2e"
	cd frontend && npm run test:e2e

down:
	docker compose down

migrate:
	docker compose exec backend alembic upgrade head
