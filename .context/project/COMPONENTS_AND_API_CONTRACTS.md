# Components and API Contracts

**Project:** AI Fleet  
**Date:** 2026-02-18  
**Status:** Draft v1

## 1. Component Contracts (Hexagonal)

## 1.1 Inbound Ports

- `FleetQueryPort`
- `getFleetOverview(filters)`
- `getVehicleDetail(vehicleId)`
- `getAlerts(filters)`

- `ScenarioCommandPort`
- `runScenario(scenarioId, seed)`
- `pauseReplay(runId)`
- `resumeReplay(runId)`
- `resetReplay(runId)`

- `TelemetryIngestionPort`
- `ingestTelemetry(batch)`
- `ingestEvent(batch)`
- `upsertEmitterHeartbeat(emitterId, status)`

- `AiUseCasePort`
- `getDailySummary(range)`
- `explainAlert(alertId)`
- `getNextActions(vehicleId?, alertId?)`
- `chat(message, contextScope, vehicleId?)`

## 1.2 Outbound Ports

- `TelemetryRepositoryPort`
- `readTelemetrySlice(vehicleId, fromTs, toTs, limit)`
- `appendTelemetry(points)`

- `EventRepositoryPort`
- `appendEvent(event)`
- `listEvents(filters)`

- `AlertRepositoryPort`
- `createAlert(alert)`
- `ackAlert(alertId, actorId?)`
- `listAlerts(filters)`

- `ScenarioRepositoryPort`
- `startRun(scenarioId, seed)`
- `updateRunState(runId, status, cursorTs)`

- `EmitterRegistryPort`
- `registerEmitter(emitterId, vehicleType, replicaIndex)`
- `listEmitters(filters)`

- `AiInferencePort`
- `generateCompletion(messages, options)`
- `generateEmbedding?(input)`

- `StreamPublisherPort`
- `publishTelemetry(point)`
- `publishEvent(event)`
- `publishVehicleState(state)`

## 1.3 Adapter Mapping

- HTTP controllers -> inbound ports
- Ingestion controllers -> ingestion port
- WebSocket gateway -> inbound query/use-case ports + stream publisher
- Postgres adapter -> repository outbound ports
- Ollama adapter -> AI inference outbound port

## 2. API Contracts (HTTP)

Vehicle identity model:

- `vehicleId`: internal immutable key (example: `V-014`) used by API paths and joins.
- `vehicleRegNo`: display/ops identifier in Indian registration format (example: `TS09QJ7744`) shown in UI and reports.
- Seed/default generation format: `SSNNLLNNNN` (example: `KA01MN4321`, `MH12PV6620`, `TS10LK5591`).

Base path: `/api`  
Response envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "req-uuid",
    "ts": "2026-02-18T20:00:00Z"
  },
  "error": null
}
```

Mode behavior:

- `replay` mode: telemetry source is database replay timelines/scenarios.
- `live` mode: telemetry source is scaled `vehicle-emitter-*` containers via ingest APIs.
- Both modes feed the same rule engine, alert lifecycle, WebSocket events, and UI.
- Compose topology and scale commands are documented in `./RUNBOOKS/docker-compose-topology-and-scaling.md`.

## 2.1 Fleet Queries

### GET `/api/fleet/vehicles`

Query params:

- `status?=on_trip|idle|parked|off_route|alerting|maintenance_due`
- `city?=Bengaluru`
- `depotId?=D-BLR`
- `vehicleType?=car|van|truck`
- `driverScoreMin?=70`
- `driverScoreMax?=100`
- `vehicleRegNo?=TS09QJ7744`
- `search?=TS09QJ7744`
- `limit?=50`
- `cursor?=opaque`

Contract:

- Returns vehicles with latest state, assigned driver profile (including safety score), status flags, and `vehicleRegNo`.

### GET `/api/fleet/vehicles/:vehicleId`

Query params:

- `telemetryWindowMin?=30`
- `eventLimit?=100`

Contract:

- Returns vehicle profile, current trip, recent telemetry buffer, and event stream.

### GET `/api/fleet/mode`

Response:

- `mode` (`replay|live`)
- `activeScenarioRunId?`
- `activeEmitterCount`

### POST `/api/fleet/mode`

Request body:

```json
{
  "mode": "replay"
}
```

Contract:

- Switches telemetry source mode for the demo session.

## 2.2 Alerts

### GET `/api/alerts`

Query params:

- `severity?=LOW|MEDIUM|HIGH`
- `type?=FUEL_ANOMALY|GEOFENCE_BREACH|OFF_ROUTE|DTC_FAULT|HARSH_BRAKE|OVERSPEED|FATIGUE`
- `status?=OPEN|ACK|CLOSED`
- `fromTs?=epochMs`
- `toTs?=epochMs`
- `vehicleId?=V-014`
- `vehicleRegNo?=TS09QJ7744`

### POST `/api/alerts/:alertId/ack`

Request body:

```json
{
  "actorId": "ops-user-01",
  "note": "Acknowledged and contacted driver"
}
```

Contract:

- Transitions alert status from `OPEN` to `ACK`.

## 2.3 Scenario/Replay

### POST `/api/scenarios/run`

Request body:

```json
{
  "scenarioId": "A",
  "seed": 42,
  "speedFactor": 1
}
```

Response includes:

- `runId`
- `status` (`RUNNING`)
- `scenarioId`
- `startedAt`

### POST `/api/scenarios/:runId/pause`
### POST `/api/scenarios/:runId/resume`
### POST `/api/scenarios/:runId/reset`

Contract:

- Replay lifecycle controls for deterministic demo operation.
- Supported scenario IDs for demo mode: `A` (Off-route), `B` (Fuel anomaly), `C` (Maintenance fault), `D` (Driver fatigue).

## 2.4 Ingestion (Live Emitter Mode)

### POST `/api/ingest/telemetry`

Request body:

```json
{
  "emitterId": "emitter-car-3",
  "vehicleType": "car",
  "records": [
    {
      "vehicleId": "V-014",
      "vehicleRegNo": "TS09QJ7744",
      "ts": 1730000000000,
      "lat": 17.385,
      "lng": 78.4867,
      "speedKph": 42,
      "ignition": true,
      "fuelPct": 63.1,
      "engineTempC": 87,
      "batteryV": 12.5,
      "odometerKm": 45671.2
    }
  ]
}
```

Contract:

- Validates and persists telemetry batch.
- Returns accepted/rejected counts per record.
- Triggers downstream rule evaluation and WebSocket publish.

### POST `/api/ingest/events`

Request body:

```json
{
  "emitterId": "emitter-truck-1",
  "records": [
    {
      "vehicleId": "V-025",
      "vehicleRegNo": "MH12PV6620",
      "ts": 1730000005000,
      "type": "HARSH_BRAKE",
      "severity": "MEDIUM",
      "message": "Speed dropped 28kph in 2.5s"
    }
  ]
}
```

### POST `/api/ingest/heartbeat`

Request body:

```json
{
  "emitterId": "emitter-van-4",
  "vehicleType": "van",
  "replicaIndex": 4,
  "ts": 1730000010000,
  "status": "online"
}
```

Contract:

- Tracks active emitters for dashboard and mode diagnostics.

## 2.5 AI

### POST `/api/ai/summary`

Request:

```json
{
  "range": "today"
}
```

Response contract:

- Summary text
- KPI snapshot
- prioritized actions
- evidence references (`vehicleId`, `vehicleRegNo`, `eventId`, `ts`)

### POST `/api/ai/explain-alert`

Request:

```json
{
  "alertId": "ALT-20260218-0001"
}
```

Response contract:

- what happened
- likely causes
- recommended actions
- evidence list with telemetry/event references

### POST `/api/ai/next-actions`

Request:

```json
{
  "vehicleId": "V-014",
  "vehicleRegNo": "TS09QJ7744",
  "alertId": "ALT-20260218-0001"
}
```

### POST `/api/ai/chat`

Request:

```json
{
  "message": "Which vehicles are wasting fuel today and why?",
  "contextScope": "fleet",
  "vehicleId": null
}
```

Response contract:

- answer text
- cited evidence objects
- confidence (`low|medium|high`)

Intent coverage for MVP:

- fuel wastage analysis
- risky drivers and contributing factors
- maintenance-due shortlist
- active alert summaries
- route-plan recommendation hints (heuristic suggestion, not full route optimization engine)

## 3. WebSocket Contract

Endpoint: `/ws`

Message envelope:

```json
{
  "type": "telemetry|event|vehicle_state|replay_status",
  "sequence": 10023,
  "ts": 1730000000000,
  "data": {}
}
```

Types:

- `telemetry`: telemetry point delta
- `event`: generated or scripted event
- `vehicle_state`: latest status projection
- `replay_status`: run lifecycle updates (`RUNNING|PAUSED|COMPLETED|RESET`)
- `ingest_status`: live ingestion source updates (`EMITTER_ONLINE|EMITTER_OFFLINE|BATCH_REJECTED`)

## 4. Error Contract

HTTP error envelope:

```json
{
  "data": null,
  "meta": {
    "requestId": "req-uuid",
    "ts": "2026-02-18T20:00:00Z"
  },
  "error": {
    "code": "ALERT_NOT_FOUND",
    "message": "Alert ALT-... not found",
    "details": {}
  }
}
```

Initial canonical error codes:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `REPLAY_STATE_INVALID`
- `AI_PROVIDER_UNAVAILABLE`
- `INTERNAL_ERROR`

## 5. Configuration Contract (12-Factor)

All runtime config must come from environment variables:

- `APP_ENV`
- `WEB_PORT`
- `API_PORT`
- `DATABASE_URL`
- `WS_PUBLIC_URL`
- `REPLAY_TICK_MS`
- `REPLAY_DEFAULT_SEED`
- `FLEET_MODE` (`replay|live`)
- `AI_PROVIDER` (`ollama|cloud`)
- `OLLAMA_BASE_URL`
- `OLLAMA_CHAT_MODEL`
- `OLLAMA_EMBED_MODEL`
- `CLOUD_LLM_BASE_URL` (future)
- `CLOUD_LLM_API_KEY` (future)
- `INGEST_API_TOKEN` (shared token for emitter containers in demo mode)
- `EMITTER_DEFAULT_RATE_MS`

## 6. Interface Component Layout and Functionality

## 6.1 Global Application Shell

Layout:

- `AppShell`
- `LeftNav`
- `TopBar`
- `MainContent`
- `AiCopilotDrawer` (toggleable)

Functionality:

- `LeftNav` routes between `Overview`, `Alerts`, and `Vehicle Detail`.
- `TopBar` exposes global search (vehicle ID/name/reg-no), scenario controls, and connection status.
- `AiCopilotDrawer` is available on all pages and keeps conversation state per session.

## 6.2 Overview Page (`/`)

Layout:

- `KpiCardsRow`
- `ScenarioControls`
- `FleetMapPanel`
- `VehicleTablePanel`

Functionality:

- `KpiCardsRow` shows live totals: active trips, open alerts, idle vehicles, maintenance due.
- `ScenarioControls` starts/pauses/resets replay using scenario API endpoints.
- `FleetMapPanel` renders vehicle markers, status colors, and selected vehicle highlight.
- `VehicleTablePanel` supports filter/search/sort and deep-links to `/vehicles/:id`.
- Required filters: city, depot, driver safety score range, vehicle type, and status pills.
- Vehicle primary display column must be Indian `vehicleRegNo` (internal `vehicleId` shown as secondary metadata).
- Default fleet scale target: 20 to 200 simulated vehicles.

Data contracts used:

- `GET /api/fleet/vehicles`
- WebSocket: `telemetry`, `vehicle_state`, `replay_status`

## 6.3 Alerts Page (`/alerts`)

Layout:

- `AlertFiltersBar`
- `AlertsListPanel`
- `AlertDetailPanel`

Functionality:

- `AlertFiltersBar` applies severity/type/status/time filters.
- `AlertsListPanel` shows paginated alerts with status and evidence indicator.
- `AlertDetailPanel` supports:
- acknowledge alert
- request AI explanation
- display cited evidence and recommended actions

Data contracts used:

- `GET /api/alerts`
- `POST /api/alerts/:alertId/ack`
- `POST /api/ai/explain-alert`
- WebSocket: `event`, `vehicle_state`

## 6.4 Vehicle Detail Page (`/vehicles/:vehicleId`)

Layout:

- `VehicleHeader`
- `TelemetryCardsGrid`
- `TelemetryChartsPanel` (speed/fuel/engine temp)
- `TripTimelinePanel`
- `VehicleEventsPanel`
- `IncidentActionsPanel`

Functionality:

- Displays near-live telemetry and route context for a single vehicle.
- Vehicle header must show `vehicleRegNo` prominently, with `vehicleId` as secondary.
- Required live telemetry cards: speed, ignition, idling state, fuel percent, engine temperature, battery voltage, odometer.
- Shows event chronology and current alert state.
- Shows trip timeline including stops and dwell durations.
- Provides "Generate Incident Report" and "Next Actions" AI actions.

Data contracts used:

- `GET /api/fleet/vehicles/:vehicleId`
- `POST /api/ai/next-actions`
- WebSocket: `telemetry`, `event`, `vehicle_state`

## 6.5 AI Copilot Drawer (Global)

Layout:

- `PromptInput`
- `SuggestedPrompts`
- `ResponseThread`
- `EvidencePanel`

Functionality:

- Supports fleet-level and vehicle-scoped questions.
- Must always return evidence references (`vehicleId`, `vehicleRegNo`, `eventId`, `timestamp`) when claims are made.
- Uses local Ollama provider by default through AI endpoint contracts.
- Includes one-click actions:
- Daily summary
- Explain selected alert
- Top 5 cost leaks
- Narrated incident report for selected vehicle/alert

Data contracts used:

- `POST /api/ai/summary`
- `POST /api/ai/chat`
- `POST /api/ai/next-actions`

## 6.6 Frontend State and Sync Rules

- `FleetStore`: latest vehicle state projection and map/table rows.
- `TelemetryStore`: rolling per-vehicle chart buffers.
- `AlertsStore`: filtered list and selected alert context.
- `AiStore`: prompt/response thread and evidence snapshots.

Sync behavior:

- Initial page load uses REST snapshot.
- WebSocket deltas merge into store by `sequence`.
- On sequence gap or reconnect, client triggers a REST resync for affected views.
