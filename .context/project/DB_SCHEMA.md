# Database Schema V1

**Project:** AI Fleet  
**Date:** 2026-02-18  
**Primary Artifact:** `db/migrations/0001_init.sql`

## Purpose

Provide the first concrete implementation artifact required before application coding: PostgreSQL schema DDL for replay + live ingest modes.

## Schema Scope

Domain and master data:

- `depots`
- `geofences`
- `routes`
- `route_points`
- `drivers`
- `vehicles`

Scenario and runtime orchestration:

- `scenario_definitions`
- `scenario_definition_steps`
- `scenario_runs`
- `fleet_runtime_state`
- `emitter_heartbeats`

Operational telemetry and incidents:

- `trips`
- `trip_stops`
- `telemetry_points`
- `events`
- `alerts`
- `vehicle_latest_state`

AI evidence/audit:

- `ai_artifacts`

Seed metadata:

- `seed_batches`

## Important Design Notes

- Uses schema namespace: `fleet`
- Supports two source modes:
- `replay` (DB-seeded deterministic timelines)
- `live` (ingestion from scaled emitter containers)
- Enforces Indian registration format via regex checks.
- Includes indexes for high-frequency telemetry and alert queries.
- Includes update timestamp triggers for mutable tables.

## Migration Execution (example)

```bash
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
```

## What This Unblocks

- DB migration story implementation
- Seed loader implementation
- API repository interfaces
- Replay engine persistence model
- Live ingest API persistence model

