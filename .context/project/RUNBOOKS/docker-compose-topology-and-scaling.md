# Runbook: Docker Compose Topology and Scaling

**Date:** 2026-02-18  
**Scope:** Concrete Compose design for replay mode and live emitter mode

## Purpose

Define exact service names, profiles, and scaling commands for demo operations.

## Service Names (Compose)

Core services:

- `web`: Next.js dashboard
- `api`: backend API, rule engine, replay orchestrator
- `db`: PostgreSQL
- `ollama`: local AI provider endpoint

Operational jobs:

- `migrator`: one-shot schema migration job
- `seed-loader`: one-shot data seeding job

Live emitter services (scaled by type):

- `vehicle-emitter-car`
- `vehicle-emitter-van`
- `vehicle-emitter-truck`

## Compose Profiles

- `core`: `web`, `api`, `db`, `ollama`
- `ops`: `migrator`, `seed-loader`
- `emitters`: `vehicle-emitter-car`, `vehicle-emitter-van`, `vehicle-emitter-truck`

## Proposed Compose Skeleton

```yaml
services:
  db:
    image: postgres:16
  ollama:
    image: ollama/ollama:latest
  api:
    build: ./apps/api
    depends_on: [db, ollama]
  web:
    build: ./apps/web
    depends_on: [api]
  migrator:
    build: ./apps/api
    command: ["npm", "run", "db:migrate"]
    profiles: ["ops"]
    depends_on: [db]
  seed-loader:
    build: ./apps/api
    command: ["npm", "run", "db:seed"]
    profiles: ["ops"]
    depends_on: [db, migrator]
  vehicle-emitter-car:
    build: ./apps/vehicle-emitter
    environment:
      VEHICLE_TYPE: car
    profiles: ["emitters"]
    depends_on: [api]
  vehicle-emitter-van:
    build: ./apps/vehicle-emitter
    environment:
      VEHICLE_TYPE: van
    profiles: ["emitters"]
    depends_on: [api]
  vehicle-emitter-truck:
    build: ./apps/vehicle-emitter
    environment:
      VEHICLE_TYPE: truck
    profiles: ["emitters"]
    depends_on: [api]
```

## Identity and Data Contract for Emitters

- Each emitter replica must resolve a stable identity:
- `emitterId = <service-name>-<replica-index>`
- Vehicles are assigned deterministically from DB by vehicle type and emitter index.

- Emitters post telemetry/events to:
- `POST /api/ingest/telemetry`
- `POST /api/ingest/events`
- `POST /api/ingest/heartbeat`

## Startup Commands

Core startup:

```bash
docker compose --profile core up -d db ollama api web
```

Run migrations and seed data:

```bash
docker compose --profile ops run --rm migrator
docker compose --profile ops run --rm seed-loader
```

## Replay Demo Commands

Set mode:

```bash
curl -X POST http://localhost:3001/api/fleet/mode -H "Content-Type: application/json" -d "{\"mode\":\"replay\"}"
```

Run scenario:

```bash
curl -X POST http://localhost:3001/api/scenarios/run -H "Content-Type: application/json" -d "{\"scenarioId\":\"A\",\"seed\":42,\"speedFactor\":1}"
```

## Live Demo Commands (Scaled by Type)

Set mode:

```bash
curl -X POST http://localhost:3001/api/fleet/mode -H "Content-Type: application/json" -d "{\"mode\":\"live\"}"
```

Small live demo scale (10 vehicles):

```bash
docker compose --profile emitters up -d \
  --scale vehicle-emitter-car=6 \
  --scale vehicle-emitter-van=3 \
  --scale vehicle-emitter-truck=1 \
  vehicle-emitter-car vehicle-emitter-van vehicle-emitter-truck
```

Standard live demo scale (30 vehicles):

```bash
docker compose --profile emitters up -d \
  --scale vehicle-emitter-car=18 \
  --scale vehicle-emitter-van=9 \
  --scale vehicle-emitter-truck=3 \
  vehicle-emitter-car vehicle-emitter-van vehicle-emitter-truck
```

Large live demo scale (100 vehicles):

```bash
docker compose --profile emitters up -d \
  --scale vehicle-emitter-car=60 \
  --scale vehicle-emitter-van=30 \
  --scale vehicle-emitter-truck=10 \
  vehicle-emitter-car vehicle-emitter-van vehicle-emitter-truck
```

Stop emitters:

```bash
docker compose stop vehicle-emitter-car vehicle-emitter-van vehicle-emitter-truck
```

## Health and Verification

Service health:

```bash
docker compose ps
```

Mode check:

```bash
curl http://localhost:3001/api/fleet/mode
```

Emitter heartbeat check:

```bash
curl http://localhost:3001/api/fleet/mode | jq ".data.activeEmitterCount"
```

Expected dashboard behavior:

- Replay mode: deterministic scenario timeline and repeatable alerts
- Live mode: continuous ingestion-driven movement and events from scaled emitters

## Environment Variables (Minimum)

- `FLEET_MODE` (`replay|live`)
- `DATABASE_URL`
- `OLLAMA_BASE_URL`
- `INGEST_API_TOKEN`
- `EMITTER_DEFAULT_RATE_MS`
- `EMITTER_JITTER_METERS`
- `EMITTER_RETRY_BACKOFF_MS`

