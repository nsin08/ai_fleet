# AI Fleet

**Fleet operations demo platform** — distributed vehicle telemetry, real-time alerting, AI-assisted operations, and governed delivery via [space_framework](https://github.com/nsin08/space_framework).

---

## What This Is

A full-stack, container-first fleet management platform designed for demo and evaluation. It simulates a real-time fleet of vehicles (cars, vans, trucks) operating across Indian cities, with:

- **Replay mode** — deterministic scripted scenarios driven from PostgreSQL
- **Live mode** — scaled vehicle emitter containers posting real-time telemetry
- **AI Copilot** — Ollama-backed local LLM for alert explanations, fleet chat, and next-action recommendations
- **Real-time dashboard** — Next.js multi-page UI with WebSocket telemetry feed
- **Rule engine** — Automatic event/alert generation from telemetry thresholds
- **Governance-enforced delivery** — every code change goes through space_framework state machine

---

## Quick Start

### Prerequisites

- Docker + Docker Compose v2
- Node.js 20+ (for local dev outside containers)
- Ollama running on your laptop: `ollama serve`
- Recommended models: `ollama pull deepseek-r1:8b` and `ollama pull mxbai-embed-large`

### 1. Start Core Services

```bash
docker compose --profile core up -d db api web
```

### 2. Run Migrations + Seed Data (first run only)

```bash
docker compose --profile ops run --rm migrator
docker compose --profile ops run --rm seed-loader
```

### 3. Verify

```bash
# Check containers
docker compose ps

# API health
curl http://localhost:3001/healthz

# Fleet mode
curl http://localhost:3001/api/fleet/mode

# Dashboard
open http://localhost:3000
```

### 4. Run a Demo Scenario (Replay Mode)

```bash
# List available scenarios
curl http://localhost:3001/api/scenarios | jq '.data[].id'

# Start a scenario
curl -X POST http://localhost:3001/api/scenarios/scenario-mixed-alert/run \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 5. Start Live Telemetry (Live Mode)

```bash
docker compose --profile live up -d vehicle-emitter
```

### 6. Ask the AI Copilot

```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Give me a fleet status snapshot"}'
```

---

## Architecture

Hexagonal (Ports & Adapters) + SOLID + 12-Factor. No framework coupling in domain logic.

```
ai_fleet/
├── apps/
│   ├── api/              # Express.js + TypeScript — REST, WebSocket, replay engine, rule engine
│   ├── web/              # Next.js 14 + Tailwind — multi-page dashboard
│   └── vehicle-emitter/  # Node.js — containerized live telemetry emitter
├── packages/
│   ├── domain/           # Pure entities, port interfaces (no IO, no deps)
│   └── adapters/         # PostgreSQL, Ollama, clock/RNG implementations
├── db/
│   ├── migrations/       # PostgreSQL schema (0001_init.sql)
│   └── seeds/            # Reference data + demo scenarios
├── .context/
│   ├── project/          # Architecture, ADRs, API contracts (committed)
│   └── sprint/           # Sprint plans and retros (committed)
└── docker-compose.yml
```

### Domain Entities

`vehicle`, `driver`, `depot`, `route`, `trip`, `telemetry_point`, `fleet_event`, `alert`, `scenario_run`, `vehicle_latest_state`, `fleet_runtime_state`

### Dashboard Pages

| Page | URL | Features |
|------|-----|----------|
| **Overview** | `/` | KPI cards, scenario controls, vehicle table, live WebSocket feed |
| **Alerts** | `/alerts` | Filter by status/severity, detail panel, ack/close/AI explain |
| **Vehicle Detail** | `/vehicles/:id` | Telemetry cards, history table, open alerts, live updates |
| **Scenarios** | `/scenarios` | Scenario cards, step listing, run/pause/resume/reset controls |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Health check |
| `GET` | `/api/fleet/mode` | Current fleet mode (replay/live) |
| `GET` | `/api/fleet/vehicles` | Vehicle list with filters |
| `GET` | `/api/fleet/vehicles/:id` | Vehicle detail + telemetry + alerts |
| `GET` | `/api/alerts` | Alert list with status/severity filters |
| `POST` | `/api/alerts/:id/ack` | Acknowledge alert |
| `POST` | `/api/alerts/:id/close` | Close alert |
| `GET` | `/api/scenarios` | List scenario definitions |
| `GET` | `/api/scenarios/:id` | Scenario definition detail |
| `POST` | `/api/scenarios/:id/run` | Start scenario replay |
| `POST` | `/api/scenarios/runs/:id/pause` | Pause replay |
| `POST` | `/api/scenarios/runs/:id/resume` | Resume replay |
| `POST` | `/api/scenarios/runs/:id/reset` | Reset replay |
| `POST` | `/api/ingest/telemetry` | Batch telemetry from emitters |
| `POST` | `/api/ingest/events` | Batch events from emitters |
| `POST` | `/api/ai/chat` | AI fleet chat |
| `POST` | `/api/ai/explain-alert` | AI alert explanation |
| `WS` | `/ws` | Real-time telemetry/event/alert/state stream |

See [`.context/project/ARCHITECTURE.md`](.context/project/ARCHITECTURE.md) and [`.context/project/COMPONENTS_AND_API_CONTRACTS.md`](.context/project/COMPONENTS_AND_API_CONTRACTS.md) for full design detail.

---

## Demo Scenarios

| ID | Name | Timeline | Events |
|----|------|----------|--------|
| `scenario-mixed-alert` | Mixed Alert Demo | 120s | Overspeed, harsh brake, fuel anomaly alerts |
| `scenario-geofence-breach` | Geofence Breach | 90s | Route deviation + geofence entry |
| `scenario-maintenance-cascade` | Maintenance Cascade | 150s | DTC faults, engine temp, maintenance due |

### Demo Walkthrough

1. Open dashboard at `http://localhost:3000`
2. On the Overview page, select a scenario from the dropdown
3. Click "Start" — fleet mode switches to "replay"
4. Watch the live event feed (right sidebar) as telemetry streams in
5. Navigate to **Alerts** to see generated alerts, acknowledge or close them
6. Click "AI Explain" on any alert for Ollama-powered root cause analysis
7. Navigate to **Scenarios** to pause/resume/reset the replay
8. Start the vehicle emitter for live telemetry alongside or instead of replay

---

## AI Provider

Default: **Ollama** (local, no API key needed).

Available models detected:
- `deepseek-r1:8b` — recommended for explanations
- `mxbai-embed-large` — embeddings
- `phi` — lightweight fallback

Configure via environment:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=deepseek-r1:8b
OLLAMA_EMBED_MODEL=mxbai-embed-large:latest
```

---

## Key Documents

| Document | Location |
|----------|----------|
| Architecture & component design | [`.context/project/ARCHITECTURE.md`](.context/project/ARCHITECTURE.md) |
| API + WebSocket contracts | [`.context/project/COMPONENTS_AND_API_CONTRACTS.md`](.context/project/COMPONENTS_AND_API_CONTRACTS.md) |
| Docker Compose topology & scaling | [`.context/project/RUNBOOKS/docker-compose-topology-and-scaling.md`](.context/project/RUNBOOKS/docker-compose-topology-and-scaling.md) |
| Demo scenarios playbook | [`.context/project/RUNBOOKS/demo-scenarios-playbook.md`](.context/project/RUNBOOKS/demo-scenarios-playbook.md) |
| Data seeding & map realism | [`.context/project/RUNBOOKS/data-seeding-and-map-realism.md`](.context/project/RUNBOOKS/data-seeding-and-map-realism.md) |
| DB schema | [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql) |
| ADRs | [`.context/project/ADR/`](.context/project/ADR/) |
| Governance instructions | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) |

---

## Governance

All delivery is managed via [space_framework](https://github.com/nsin08/space_framework):

- **State machine:** Idea → Approved → Ready → In Progress → In Review → Done → Released
- **Branch naming:** `feature/<issue-id>-<slug>`, `fix/<issue-id>-<slug>`
- **PR rule:** every PR must link to an issue (`Closes #<id>`) with an evidence mapping table
- **Merge authority:** @nsin08 only (enforced via CODEOWNERS + branch protection)
- **Enforcement:** 17 GitHub Actions workflows in `.github/workflows/`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · SWR |
| Backend API | Node.js · TypeScript · Express · Zod |
| Domain / Ports | TypeScript (pure, no IO) |
| Database | PostgreSQL 16 (schema `fleet`) |
| AI Provider | Ollama (local) — deepseek-r1:8b |
| Vehicle Emitter | Node.js · TypeScript (containerized) |
| Testing | Jest 29 · ts-jest · Supertest |
| Container Runtime | Docker Compose (profiles: core, ops, live) |
| Governance | space_framework v1.0.0-alpha |

---

## Testing

```bash
# Run all tests
npm test --workspace=packages/domain
npm test --workspace=apps/api

# Domain: 55 tests — entity contracts, type unions, port interfaces
# API: 26 tests — route handlers, validation, error handling (mocked adapters)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (see compose) | PostgreSQL connection string |
| `DB_HOST` | `db` | Database hostname |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `ai_fleet` | Database name |
| `DB_USER` | `fleet_user` | Database username |
| `DB_PASSWORD` | `fleet_pass` | Database password |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama API URL |
| `OLLAMA_CHAT_MODEL` | `deepseek-r1:8b` | Chat/reasoning model |
| `OLLAMA_EMBED_MODEL` | `mxbai-embed-large:latest` | Embedding model |
| `VEHICLE_ID` | `veh-mum-01` | Emitter vehicle ID |
| `VEHICLE_REG_NO` | `MH04AB1001` | Emitter vehicle registration |
| `API_PORT` | `3001` | API server port |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
