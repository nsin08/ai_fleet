# Runbook: Telemetry Replay Operations

**Date:** 2026-02-18  
**Scope:** Operating simulation replay against database-backed telemetry

## Purpose

Define expected replay lifecycle for deterministic fleet demo scenarios.

## Replay Model

- Replay reads historical telemetry from database tables
- Replay emits events as a live stream to API/WebSocket consumers
- Rule engine evaluates thresholds and persists generated events/alerts

## Core Operator Actions (Target APIs)

1. Start replay for scenario (`A`, `B`, or `C`)
2. Pause replay
3. Resume replay
4. Reset replay to initial state
5. Query replay status and current timestamp cursor

## Replay Invariants

- Same scenario ID + seed must produce same event order
- Replay writes must be traceable to a `scenario_run_id`
- Alert evidence must include referenced timestamps and event IDs

## Monitoring Signals

- replay ticks per minute
- event generation rate by type
- alert creation rate by severity
- WebSocket client count and lag

## Common Issues

- Missing telemetry slices:
- Cause: partial seed load or schema mismatch
- Action: rerun seed loader and validate counts

- Non-deterministic outputs:
- Cause: unseeded random path or wall-clock dependency
- Action: enforce seeded RNG and event-time scheduling

- Drift between replay and UI:
- Cause: stale client store or dropped WS events
- Action: trigger state resync endpoint and compare last sequence ID

