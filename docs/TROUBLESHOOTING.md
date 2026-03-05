# Troubleshooting

Common issues when running Photowalker locally.

## Port 5432 Already Allocated

Docker reports `Bind for 0.0.0.0:5432 failed: port is already allocated` when something else is using PostgreSQL's default port (often another container or a local Postgres install).

### Option A – Free Port 5432 (Recommended)

1. List containers that might be using 5432:
   ```bash
   docker ps --format '{{.Names}} {{.Ports}}' | grep 5432
   ```
2. Stop the photowalker stack (if it's from a previous run):
   ```bash
   docker compose down
   ```
   Run from project root.
3. If you use another Postgres (e.g. Homebrew), stop it:
   ```bash
   brew services stop postgresql
   ```
   (or equivalent for your setup)
4. Start the stack again:
   ```bash
   docker compose up -d
   ```
   From project root.

### Option B – Use a Different Host Port

1. In `docker-compose.yml`, change the postgres `ports` to e.g. `"5433:5432"`.
2. In `backend/.env`, set `DATABASE_URL=postgresql+asyncpg://photowalker:photowalker@localhost:5433/photowalker`.
3. Run `docker compose up -d` from project root. The app will connect to Postgres on 5433.

## Platform Warning (linux/amd64 vs arm64)

On Apple Silicon, you may see a warning that the PostGIS image is linux/amd64. The container still runs under emulation.

To use an ARM image instead, set in `docker-compose.yml` under the postgres service:

```yaml
platform: linux/arm64
```

Only do this if the image supports arm64; postgis/postgis may not publish arm64.
