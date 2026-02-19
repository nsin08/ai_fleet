# AI Fleet — Docker Compose Quick Start

This is the fastest reliable sequence to bring up AI Fleet locally.

## 0) Preflight (host)

```powershell
# from repo root
cd D:\wsl_shared\projects\ai_fleet

# Ollama must run on host (not in compose)
ollama list
# if not running:
# ollama serve
```

## 1) Environment

```powershell
cp .env.example .env
```

## 2) Start core services

```powershell
docker compose --profile core up -d db api web
```

Expected ports:
- Web: http://localhost:3000
- API: http://localhost:3001/healthz
- Postgres host port: `5433` (container still listens on `5432`)

## 3) Run schema migration (one-time per fresh DB)

```powershell
docker compose --profile ops run --rm migrator
```

## 4) Load seed data (if seed SQL files exist)

```powershell
docker compose --profile ops run --rm seed-loader
```

## 5) Verify runtime

```powershell
docker compose ps
curl http://localhost:3001/healthz
```

## 6) Optional: run live emitter profile

```powershell
docker compose --profile live up -d vehicle-emitter
```

This now brings up `db` + `api` automatically (profile-aligned dependencies).

## 7) Useful operations

```powershell
# logs
docker compose logs -f api
docker compose logs -f web

docker compose logs -f db

# restart one service
docker compose restart api

# stop everything
docker compose down

# stop + remove volumes (destructive: clears DB)
docker compose down -v
```

## Common issues

- `migrator depends on undefined service db`
  - Run with `--profile ops` (already fixed in compose), and ensure compose file is up to date.

- `Bind for 0.0.0.0:5432 failed`
  - This stack maps DB to host `5433`, so use `5433` locally.

- API shows unhealthy initially
  - Wait a few seconds and re-run `docker compose ps`.

- Web loads but no vehicles/alerts
  - Run `migrator`, then `seed-loader`.

- Ollama errors from API
  - Ensure host Ollama is running: `ollama serve` and models are available: `ollama list`.
