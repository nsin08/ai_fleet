# AI Fleet

**Fleet operations demo platform** — distributed vehicle telemetry, real-time alerting, AI-assisted operations, and governed delivery via [space_framework](https://github.com/nsin08/space_framework).

---

## What This Is

A full-stack, container-first fleet management platform designed for demo and evaluation. It simulates a real-time fleet of vehicles (cars, vans, trucks) operating across Indian cities, with:

- **Replay mode** — deterministic scripted scenarios driven from PostgreSQL
- **Live mode** — scaled vehicle emitter containers posting real-time telemetry
- **AI Copilot** — Ollama-backed local LLM for alert explanations, daily summaries, and next-action recommendations
- **Governance-enforced delivery** — every code change goes through space_framework state machine

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Node.js 20+, Python 3.11+ (for local dev outside containers)
- Ollama running on your laptop (host): `ollama serve` — **not** managed by Docker Compose
- Recommended model: `deepseek-r1:8b` or `phi` (verify with `ollama list`)
- API containers reach host Ollama via `http://host.docker.internal:11434`

### Start Core Services

```bash
docker compose --profile core up -d db api web
```

### Run Migrations + Seed Data

```bash
docker compose --profile ops run --rm migrator
docker compose --profile ops run --rm seed-loader
```

### Run a Demo Scenario (Replay Mode)

```bash
# Start scenario A: Off-route + Geofence breach
curl -X POST http://localhost:3001/api/scenarios/run \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"A","seed":42,"speedFactor":1}'
```

### Scale Live Emitters (Live Mode)

```bash
# Switch to live mode
curl -X POST http://localhost:3001/api/fleet/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"live"}'

# Scale to 30 vehicles (18 cars, 9 vans, 3 trucks)
docker compose --profile emitters up -d \
  --scale vehicle-emitter-car=18 \
  --scale vehicle-emitter-van=9 \
  --scale vehicle-emitter-truck=3 \
  vehicle-emitter-car vehicle-emitter-van vehicle-emitter-truck
```

---

## Architecture

Hexagonal (Ports & Adapters) + SOLID + 12-Factor. No framework coupling in domain logic.

```
ai_fleet/
├── apps/
│   ├── api/              # Node.js + TypeScript — REST, WebSocket, replay engine, rule engine
│   ├── web/              # Next.js + TypeScript + Tailwind — dashboard UI
│   └── vehicle-emitter/  # Node.js — scaled container per vehicle type (live mode)
├── packages/
│   ├── domain/           # Pure entities, port interfaces, use-case contracts (no IO)
│   └── adapters/         # PostgreSQL, Ollama, clock/RNG adapter implementations
├── db/
│   └── migrations/       # PostgreSQL schema (0001_init.sql)
├── .context/
│   ├── project/          # Architecture, ADRs, API contracts, runbooks (committed)
│   └── sprint/           # Sprint plans and retros (committed)
└── docker-compose.yml
```

See [`.context/project/ARCHITECTURE.md`](.context/project/ARCHITECTURE.md) and [`.context/project/COMPONENTS_AND_API_CONTRACTS.md`](.context/project/COMPONENTS_AND_API_CONTRACTS.md) for full design detail.

---

## Demo Scenarios

| ID | Name | Vehicle | What Happens |
|----|------|---------|-------------|
| A | Off-Route + Geofence Breach | `KA01MN4321` | Route deviation → geofence alert |
| B | Fuel Theft Anomaly | `TS09QJ7744` | Abnormal fuel drop at low speed |
| C | DTC Overheat + Maintenance Due | `KA53TR1088` | Engine fault codes + maintenance flag |
| D | Driver Fatigue | `TS10LK5591` | Fatigue indicators over long shift |

See [`.context/project/RUNBOOKS/demo-scenarios-playbook.md`](.context/project/RUNBOOKS/demo-scenarios-playbook.md).

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
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| Backend API | Node.js · TypeScript · Express/Fastify |
| Domain / Ports | TypeScript (pure, no IO) |
| Database | PostgreSQL 16 |
| AI Provider | Ollama (local) → cloud LLM (future) |
| Vehicle Emitter | Node.js · TypeScript (containerized) |
| Container Runtime | Docker Compose |
| Governance | space_framework v1.0.0-alpha |
