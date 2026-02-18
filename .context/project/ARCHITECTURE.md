# AI Fleet Architecture

**Project:** AI Fleet  
**Version:** 0.2 (principles + contracts)  
**Date:** 2026-02-18  
**Status:** Draft for implementation planning

## 1. Context

This repository is governance-first and currently contains no application code.  
The target product is a fleet operations demo platform with:

- simulated telemetry and events
- replay-based behavior from database-stored telemetry data
- live emitter-based ingestion from scaled vehicle simulator containers
- AI-assisted summaries and explanations
- strict governance via `space_framework`

## 2. Architecture Principles

The implementation must follow:

- Hexagonal Architecture (Ports and Adapters)
- SOLID design principles
- 12-Factor app principles
- container-first runtime for development and demo

Implications:

- Domain logic must not depend on framework or transport details.
- Adapters (HTTP, WebSocket, DB, AI provider) are replaceable.
- Configuration is environment-driven, not hardcoded.
- Services are stateless where possible; state lives in PostgreSQL.

## 3. Target Components

## 3.1 `apps/web` (Frontend Adapter)

- Next.js + TypeScript + Tailwind
- Consumes REST and WebSocket contracts from API
- Renders overview, alerts, vehicle detail, and AI copilot

## 3.2 `apps/api` (Application + Inbound Adapters)

- Node.js + TypeScript (Express or Fastify)
- Inbound ports: REST controllers, ingestion controllers, and WebSocket gateway
- Application services orchestrate replay, live ingestion, rules, alerts, and AI use cases

## 3.3 Domain Core (`packages/domain` target)

- Entities: vehicle, driver, telemetry, event, alert, trip, scenario run
- Use cases: replay tick, generate event, manage alert lifecycle, explain alert
- Pure business logic with no direct IO

## 3.4 Outbound Adapters (`packages/adapters` target)

- PostgreSQL repository adapter
- AI provider adapter (`ollama` first, cloud provider later)
- Clock/seeded RNG adapter for deterministic replay
- Optional queue adapter for ingest buffering (future)

## 3.5 Database (`db`)

- PostgreSQL is source of truth for master data and telemetry replay data
- Stores both replay source data and derived runtime artifacts (events, alerts)

## 4. Component Interaction

1. Replay mode: replay service reads telemetry slices from PostgreSQL.
2. Live mode: scaled vehicle emitter containers post telemetry to ingestion APIs.
3. Ingestion service validates telemetry and persists it into PostgreSQL.
4. Rule service evaluates thresholds and emits domain events.
5. Alert service persists/updates alert aggregates.
6. API adapters expose query and command contracts.
7. WebSocket adapter publishes telemetry/event deltas.
8. AI service composes evidence and calls provider adapter (Ollama by default).

Detailed API and component contracts are documented in `./COMPONENTS_AND_API_CONTRACTS.md`.

## 5. Deployment Topology

Phase-1 runtime (containerized):

- `web` container
- `api` container
- `db` container (PostgreSQL)
- `ollama` service (local process or container endpoint)
- `vehicle-emitter-*` containers (live simulator agents by vehicle type)

Optional later:

- `redis` for fan-out/caching
- `reverse-proxy` for external demo access

## 6. AI Provider Strategy

- Default provider: local Ollama endpoint (demo mode)
- Provider abstraction via port (`AiInferencePort`)
- Cloud LLM provider can replace Ollama without domain/use-case rewrites

Verified local models (2026-02-18):

- `mxbai-embed-large:latest`
- `deepseek-r1:8b`
- `phi:latest`
- `smollm:latest`

## 7. Data Domains (Initial)

- `depots`, `geofences`, `routes`
- `vehicles` (includes `vehicle_id` + Indian `vehicle_reg_no`), `drivers`, `trips`
- `telemetry_points` (append-only time-series)
- `events`, `alerts`
- `scenario_runs`, `scenario_steps`
- `ai_artifacts` (optional audit snapshots)

## 8. Non-Functional Requirements

- deterministic replay by `scenario_id + seed`
- deterministic live emitter identity by container replica index + assigned seed
- full local startup via container orchestration command
- observable replay/rule logs and traceable evidence IDs
- replay and live modes must use the same downstream rules, alerts, and dashboard contracts
- no hardcoded secrets; environment-based config only
- governance compatibility with repository workflows and CODEOWNER gates

## 9. Phased Plan

- Phase 0: governance + architecture artifacts (current)
- Phase 1: monorepo + containers + DB schema/migrations/seeding
- Phase 2: replay engine + live ingest + rules + API + WebSocket
- Phase 3: frontend + AI provider integration (Ollama default)
- Phase 4: hardening and docs refresh (`README.md`, `.github/copilot-instructions.md`)
