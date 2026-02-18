# ADR 0002: Database-Backed Telemetry Replay

- **Date:** 2026-02-18
- **Status:** Accepted

## Context

The product must simulate realistic fleet behavior without hardware while preserving evidence and replay determinism.

## Decision

Use the database as the source of truth for simulation input and output:

- Seed telemetry/events are stored in database tables
- Replay engine reads historical records and emits them as live-like streams
- Derived events/alerts and latest state projections are persisted back to the database

Replay behavior must support deterministic scenario execution and repeatable demo outcomes.

## Consequences

- Pros:
- Realistic data lifecycle aligned with future production ingestion
- Replay and analysis can reuse the same persistence model
- Better auditability for AI evidence and alert generation

- Cons:
- Higher complexity than in-memory-only simulation
- Requires schema, migration, and seed management from day one

