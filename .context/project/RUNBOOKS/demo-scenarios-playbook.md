# Runbook: Demo Scenarios Playbook

**Date:** 2026-02-18  
**Scope:** Fleet demo story mode and presenter workflow

## Purpose

Provide deterministic scenario narratives for demo execution, including:

- what happens in the system
- what the audience should see
- what the AI should explain

## Preconditions

- Containers/services running: `web`, `api`, `db`, `ollama`
- Live mode services running: `vehicle-emitter-car`, `vehicle-emitter-van`, `vehicle-emitter-truck` (scaled as needed)
- Seed data loaded
- Replay service healthy
- WebSocket stream connected

## Scenario Catalog

## Demo Modes

- `replay` mode:
- deterministic, scripted scenarios from DB timelines
- best for predictable storytelling in stakeholder demos

- `live` mode:
- telemetry emitted by scaled vehicle containers and ingested in real time
- best for showing production-like streaming behavior

Mode switch API:

- `POST /api/fleet/mode` with `{"mode":"replay"}` or `{"mode":"live"}`

Vehicle mapping used in demo script:

- `V-007` -> `KA01MN4321`
- `V-014` -> `TS09QJ7744`
- `V-021` -> `KA53TR1088`
- `V-030` -> `TS10LK5591`

UI convention:

- Show `vehicleRegNo` as primary identifier.
- Keep `vehicleId` for API/debug views only.

## Scenario A: Off-Route + Geofence Breach (Vehicle `KA01MN4321`)

Trigger:

- `POST /api/scenarios/run` with `scenarioId: "A"`

Expected timeline:

1. Vehicle starts on planned route at normal speed.
2. Vehicle deviates from route beyond off-route threshold.
3. `OFF_ROUTE` event emitted.
4. Vehicle crosses configured city geofence boundary.
5. `GEOFENCE_BREACH` event emitted and HIGH alert created.
6. Vehicle returns toward planned route and trip closes.

What demo audience sees:

- map marker path deviation
- status pill changes to `off_route` then `alerting`
- alert appears in Alerts Center

What AI should produce:

- plain-English explanation of deviation and breach
- evidence: vehicle ID, vehicle registration number, timestamps, and event IDs
- recommended actions: call driver, reroute, log incident

## Scenario B: Fuel Theft Anomaly (Vehicle `TS09QJ7744`)

Trigger:

- `POST /api/scenarios/run` with `scenarioId: "B"`

Expected timeline:

1. Vehicle operates normally.
2. Vehicle speed drops near zero.
3. Fuel percentage drops sharply within anomaly window.
4. `FUEL_ANOMALY` HIGH event emitted and HIGH alert created.
5. Fuel trend stabilizes after anomaly window.

What demo audience sees:

- sudden fuel chart drop while vehicle is stationary/near-stationary
- high-severity alert in alerts list

What AI should produce:

- likely causes ranked (theft, sensor issue, leak)
- evidence references from telemetry + events, including vehicle registration number
- next actions: call driver, inspect stop location, verify receipts

## Scenario C: Maintenance Fault (Vehicle `KA53TR1088`)

Trigger:

- `POST /api/scenarios/run` with `scenarioId: "C"`

Expected timeline:

1. Vehicle runs at normal operating state.
2. Engine temperature rises above threshold.
3. `DTC_FAULT` event emitted with DTC metadata.
4. HIGH maintenance alert created.
5. `MAINTENANCE_DUE` event emitted and trip ends for service.

What demo audience sees:

- rising engine temperature chart
- fault event and maintenance alert
- vehicle status transitions to maintenance due

What AI should produce:

- root-cause hypothesis with confidence
- evidence from temperature trend and DTC event with registration reference
- recommended service and downtime guidance

## Scenario D: Driver Fatigue Pattern (Vehicle `TS10LK5591`) [Optional Extension]

Trigger:

- `POST /api/scenarios/run` with `scenarioId: "D"`

Expected timeline:

1. Vehicle remains in continuous driving window beyond fatigue threshold.
2. `FATIGUE` event emitted (MEDIUM/HIGH by configured policy).
3. Supervisor alert created for intervention.
4. Vehicle enters stop/break state; alert remains visible until ack.

What demo audience sees:

- prolonged trip timeline without break
- fatigue event in stream
- actionable supervisor alert

What AI should produce:

- fatigue risk narrative with compliance-safe wording
- evidence with route/trip duration and registration reference
- recommendation: schedule break, notify supervisor, reassign route if needed

## Presenter Flow (3-5 Minute Demo)

1. Open Overview in `replay` mode: show map, KPI cards, and filters.
2. Run Scenario A: demonstrate off-route detection and AI explanation.
3. Run Scenario B or C: demonstrate anomaly/fault alert and next actions.
4. Switch to `live` mode using `POST /api/fleet/mode`.
5. Show active emitter feed:
- vehicle positions and telemetry continue updating without scenario trigger
- ingestion health/event stream visible in dashboard
6. Open AI Copilot:
- ask "Which vehicles are wasting fuel today?"
- ask "Show risky drivers this week and why."
- trigger "Daily summary" and "Top 5 cost leaks"
7. Open vehicle detail and click "Generate Incident Report."

## Demo Narration Tips

- Always link claims to evidence IDs and timestamps.
- Keep scenario order fixed for repeatability.
- Use the same seed for deterministic behavior across runs.
