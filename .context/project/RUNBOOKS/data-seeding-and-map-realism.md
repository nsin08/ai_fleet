# Runbook: Data Seeding and Map Realism

**Date:** 2026-02-18  
**Scope:** Database seeding strategy for realistic map behavior in replay and live modes

## Purpose

Define how the system seeds master data and telemetry so dashboard movement looks realistic and deterministic.

## Seeding Strategy

Use two layers of data:

1. Master data seed (static reference)
2. Telemetry replay seed (time-series history)

## 1. Master Data Seed

Tables:

- `depots`
- `geofences`
- `routes`
- `drivers`
- `vehicles`

Requirements:

- Vehicles include:
- `vehicle_id` (internal key, e.g., `V-014`)
- `vehicle_reg_no` (Indian registration, e.g., `TS09QJ7744`)
- `vehicle_type` (`car|van|truck`)
- Route coverage per city/depot is complete for demo fleet.

## 2. Replay Time-Series Seed

Tables:

- `trips`
- `telemetry_points`
- `events`
- `alerts`
- `scenario_runs` (seeded templates or generated at runtime)

Requirements:

- Telemetry cadence default: every `2s` (configurable)
- Each point includes location, speed, ignition, fuel, engine temp, battery, odometer, heading
- Data spans enough history for at least one full demo run (recommended: 1-3 days simulated)

## 3. Map Realism Rules

- Path adherence:
- Baseline points follow route polylines (no random teleporting)

- Motion smoothing:
- Use acceleration/deceleration curves instead of abrupt speed jumps

- Stop/dwell behavior:
- Simulate signals, loading stops, and depot idle windows

- GPS noise:
- Apply small jitter (few meters), bounded to avoid visible zig-zag artifacts

- Type realism:
- Trucks accelerate slower and consume more fuel than cars
- Vans have intermediate dynamics

## 4. Scenario Overlay Rules

Scenario steps are overlays on baseline telemetry:

- A: Off-route + geofence breach
- B: Fuel anomaly at low speed
- C: DTC overheat + maintenance due
- D: Fatigue (optional)

Overlay behavior:

- Keep surrounding telemetry realistic before and after anomaly window
- Persist generated artifacts with `scenario_run_id` for traceability

## 5. Dual Mode Data Path

- Replay mode:
- Reads seeded telemetry/events from DB and re-emits as live stream

- Live mode:
- Scaled `vehicle-emitter-*` containers produce telemetry and call ingest APIs
- Ingested records are persisted into same tables used by replay pipeline

Result:

- Both modes feed identical rule engine, alerting, and dashboard contracts

## 6. Seeder Pipeline (Implementation Order)

1. Load master reference tables (`depots`, `routes`, `vehicles`, `drivers`).
2. Build trip plans per vehicle using assigned city/depot routes.
3. Generate baseline telemetry points with realism rules.
4. Inject scenario overlays for designated vehicles/time windows.
5. Derive initial events/alerts from rules and overlays.
6. Validate row counts and spatial sanity.
7. Mark seed batch metadata (`seed_version`, `seed_timestamp`, `seed_rng`).

## 7. Validation Checklist

- No vehicle has impossible jumps (>300m in 2s without matching speed profile).
- Odometer is monotonic per vehicle.
- Fuel trends are plausible except in anomaly windows.
- Event timestamps always align to telemetry windows.
- Replay run with same seed reproduces same timeline and alerts.

## 8. Demo Baseline Recommendations

- Fleet size for demos: `30` default, scalable to `200`
- Active distribution at any point:
- ~40% on trip
- ~30% idle
- ~30% parked/off
- Use fixed seed (example: `42`) for repeatable stakeholder demos

