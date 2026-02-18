# ADR 0006: Dual Demo Modes (Replay and Live Ingestion)

- **Date:** 2026-02-18
- **Status:** Accepted

## Context

The demo must support:

- deterministic storytelling for stakeholder walkthroughs
- production-like live streaming behavior from simulated emitters

## Decision

Support two telemetry source modes behind one domain pipeline:

- `replay` mode: DB-backed seeded timelines and scripted scenarios
- `live` mode: scaled `vehicle-emitter-*` containers posting ingest telemetry

Both modes must feed the same rule engine, alert lifecycle, AI evidence path, and dashboard contracts.

## Consequences

- Pros:
- Strong demo flexibility (predictable and dynamic)
- Lower divergence risk between demo paths
- Better readiness for future hardware ingestion

- Cons:
- Additional complexity in mode management and observability
- More integration testing required across both modes

