#!/usr/bin/env bash
# Clean development/test data. Does NOT run unless you pass --confirm.
# See scripts/TEST_DATA_CLEANUP.md for full description.
set -e

CONFIRM="${1:-}"

if [ "$CONFIRM" != "--confirm" ]; then
  echo "Usage: $0 --confirm"
  echo "This script will:"
  echo "  1. Truncate app tables in the database (DATABASE_URL from backend/.env)"
  echo "  2. Remove all files under backend/local_uploads/"
  echo "No changes are made without --confirm."
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Cleaning development data (--confirm passed)..."

# 1. Database: truncate in dependency order (load only DATABASE_URL from .env; avoid xargs env dump)
DATABASE_URL="postgresql+asyncpg://photowalker:photowalker@localhost:5432/photowalker"
if [ -f "backend/.env" ]; then
  while IFS= read -r line; do
    case "$line" in
      DATABASE_URL=*) v="${line#*=}"; DATABASE_URL="${v%\"}"; DATABASE_URL="${DATABASE_URL#\"}";;
    esac
  done < <(grep -v '^#' backend/.env | grep -v '^[[:space:]]*$')
fi

# Use psql if available (sync); otherwise skip DB and warn
if command -v psql >/dev/null 2>&1; then
  # Convert async URL to psql-style: postgresql+asyncpg://user:pass@host:port/db -> postgresql://user:pass@host:port/db
  PSQL_URL="${DATABASE_URL/postgresql+asyncpg/postgresql}"
  if psql "$PSQL_URL" -c "
    TRUNCATE route_photos, route_tags CASCADE;
    TRUNCATE photos, routes CASCADE;
    TRUNCATE users CASCADE;
    TRUNCATE tags CASCADE;
  " 2>/dev/null; then
    echo "Database tables truncated."
  else
    echo "Warning: could not connect to database. Is Postgres running? Skipping DB cleanup."
  fi
else
  echo "Warning: psql not found. Skipping database cleanup. Run the SQL in TEST_DATA_CLEANUP.md manually if needed."
fi

# 2. Local uploads
if [ -d "backend/local_uploads" ]; then
  rm -rf backend/local_uploads/*
  echo "backend/local_uploads/ cleared."
else
  echo "backend/local_uploads/ not present; nothing to clear."
fi

echo "Done."
