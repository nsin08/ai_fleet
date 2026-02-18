BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS fleet;
SET search_path TO fleet, public;

CREATE OR REPLACE FUNCTION fleet.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fleet.set_alert_updated_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_ts = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fleet.to_epoch_ms_utc(ts TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT (EXTRACT(EPOCH FROM (ts AT TIME ZONE 'UTC')) * 1000)::BIGINT;
$$;

CREATE TABLE IF NOT EXISTS seed_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_version TEXT NOT NULL UNIQUE,
  seed_rng INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  radius_km NUMERIC(6, 2) NOT NULL CHECK (radius_km > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fence_type TEXT NOT NULL CHECK (fence_type IN ('circle', 'polygon')),
  depot_id TEXT REFERENCES depots(id),
  city TEXT,
  center_lat NUMERIC(9, 6),
  center_lng NUMERIC(9, 6),
  radius_km NUMERIC(6, 2),
  polygon_geojson JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (fence_type = 'circle' AND center_lat IS NOT NULL AND center_lng IS NOT NULL AND radius_km IS NOT NULL)
    OR
    (fence_type = 'polygon' AND polygon_geojson IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  depot_id TEXT REFERENCES depots(id),
  route_kind TEXT NOT NULL DEFAULT 'loop',
  distance_km NUMERIC(7, 2),
  estimated_duration_sec INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_points (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 0),
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  PRIMARY KEY (route_id, seq)
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  license_id TEXT NOT NULL UNIQUE,
  base_safety_score SMALLINT NOT NULL CHECK (base_safety_score BETWEEN 0 AND 100),
  current_safety_score SMALLINT NOT NULL CHECK (current_safety_score BETWEEN 0 AND 100),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vehicle_reg_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'van', 'truck')),
  depot_id TEXT NOT NULL REFERENCES depots(id),
  fuel_capacity_l NUMERIC(7, 2) NOT NULL CHECK (fuel_capacity_l > 0),
  initial_odometer_km NUMERIC(12, 2) NOT NULL CHECK (initial_odometer_km >= 0),
  device_id TEXT NOT NULL UNIQUE,
  model TEXT,
  manufacture_year SMALLINT,
  status TEXT NOT NULL DEFAULT 'parked' CHECK (status IN ('on_trip', 'idle', 'parked', 'off_route', 'alerting', 'maintenance_due')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (vehicle_reg_no ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS scenario_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  timeline_sec INTEGER NOT NULL CHECK (timeline_sec > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenario_definition_steps (
  scenario_id TEXT NOT NULL REFERENCES scenario_definitions(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL CHECK (step_no > 0),
  at_sec INTEGER NOT NULL CHECK (at_sec >= 0),
  action TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (scenario_id, step_no)
);

CREATE TABLE IF NOT EXISTS scenario_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT REFERENCES scenario_definitions(id),
  mode TEXT NOT NULL CHECK (mode IN ('replay', 'live')),
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'RESET', 'FAILED')),
  seed INTEGER,
  speed_factor NUMERIC(6, 2) NOT NULL DEFAULT 1.0 CHECK (speed_factor > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  cursor_ts TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (mode = 'replay' AND scenario_id IS NOT NULL)
    OR
    (mode = 'live')
  )
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  route_id TEXT REFERENCES routes(id),
  scenario_run_id UUID REFERENCES scenario_runs(id),
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  start_depot_id TEXT REFERENCES depots(id),
  end_depot_id TEXT REFERENCES depots(id),
  planned_distance_km NUMERIC(9, 2),
  actual_distance_km NUMERIC(9, 2),
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS trip_stops (
  id BIGSERIAL PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 0),
  stop_type TEXT NOT NULL CHECK (stop_type IN ('traffic', 'delivery', 'depot', 'break', 'incident')),
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (departed_at IS NULL OR departed_at >= arrived_at),
  UNIQUE (trip_id, seq)
);

CREATE TABLE IF NOT EXISTS emitter_heartbeats (
  emitter_id TEXT PRIMARY KEY,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'van', 'truck')),
  replica_index INTEGER NOT NULL CHECK (replica_index >= 0),
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'degraded')),
  last_seen_ts TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_points (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  vehicle_reg_no TEXT NOT NULL,
  trip_id TEXT REFERENCES trips(id),
  scenario_run_id UUID REFERENCES scenario_runs(id),
  source_mode TEXT NOT NULL CHECK (source_mode IN ('replay', 'live')),
  source_emitter_id TEXT,
  ts TIMESTAMPTZ NOT NULL,
  ts_epoch_ms BIGINT GENERATED ALWAYS AS (fleet.to_epoch_ms_utc(ts)) STORED,
  lat NUMERIC(9, 6) NOT NULL,
  lng NUMERIC(9, 6) NOT NULL,
  speed_kph NUMERIC(6, 2) NOT NULL CHECK (speed_kph >= 0),
  ignition BOOLEAN NOT NULL,
  idling BOOLEAN NOT NULL,
  fuel_pct NUMERIC(5, 2) NOT NULL CHECK (fuel_pct BETWEEN 0 AND 100),
  engine_temp_c NUMERIC(6, 2),
  battery_v NUMERIC(5, 2),
  odometer_km NUMERIC(12, 2) NOT NULL CHECK (odometer_km >= 0),
  heading_deg NUMERIC(6, 2) CHECK (heading_deg >= 0 AND heading_deg < 360),
  rpm INTEGER CHECK (rpm IS NULL OR rpm >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (source_mode = 'live' AND source_emitter_id IS NOT NULL)
    OR
    (source_mode = 'replay')
  ),
  CHECK (vehicle_reg_no ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  vehicle_reg_no TEXT NOT NULL,
  driver_id TEXT REFERENCES drivers(id),
  trip_id TEXT REFERENCES trips(id),
  scenario_run_id UUID REFERENCES scenario_runs(id),
  source_mode TEXT NOT NULL CHECK (source_mode IN ('replay', 'live')),
  source_emitter_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('rule_engine', 'scenario_script', 'emitter', 'manual')),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'OVERSPEED',
      'HARSH_BRAKE',
      'GEOFENCE_BREACH',
      'FUEL_ANOMALY',
      'DTC_FAULT',
      'OFF_ROUTE',
      'FATIGUE',
      'MAINTENANCE_DUE'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (source_mode = 'live' AND source_emitter_id IS NOT NULL)
    OR
    (source_mode = 'replay')
  ),
  CHECK (vehicle_reg_no ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_ts TIMESTAMPTZ,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  vehicle_reg_no TEXT NOT NULL,
  driver_id TEXT REFERENCES drivers(id),
  trip_id TEXT REFERENCES trips(id),
  scenario_run_id UUID REFERENCES scenario_runs(id),
  alert_type TEXT NOT NULL CHECK (
    alert_type IN (
      'OVERSPEED',
      'HARSH_BRAKE',
      'GEOFENCE_BREACH',
      'FUEL_ANOMALY',
      'DTC_FAULT',
      'OFF_ROUTE',
      'FATIGUE',
      'MAINTENANCE_DUE'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACK', 'CLOSED')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_event_ids TEXT[] NOT NULL DEFAULT '{}',
  acknowledged_by TEXT,
  acknowledged_ts TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (closed_ts IS NULL OR closed_ts >= created_ts),
  CHECK (acknowledged_ts IS NULL OR acknowledged_ts >= created_ts),
  CHECK (vehicle_reg_no ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS ai_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_run_id UUID REFERENCES scenario_runs(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('fleet', 'vehicle', 'alert', 'trip')),
  scope_id TEXT,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('summary', 'explain_alert', 'next_actions', 'chat', 'incident_report')),
  provider TEXT NOT NULL,
  model TEXT,
  prompt_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_runtime_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  current_mode TEXT NOT NULL CHECK (current_mode IN ('replay', 'live')),
  active_scenario_run_id UUID REFERENCES scenario_runs(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_latest_state (
  vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_reg_no TEXT NOT NULL,
  driver_id TEXT REFERENCES drivers(id),
  trip_id TEXT REFERENCES trips(id),
  status TEXT NOT NULL CHECK (status IN ('on_trip', 'idle', 'parked', 'off_route', 'alerting', 'maintenance_due')),
  last_telemetry_id BIGINT REFERENCES telemetry_points(id),
  last_ts TIMESTAMPTZ,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  speed_kph NUMERIC(6, 2),
  ignition BOOLEAN,
  idling BOOLEAN,                          -- kept in sync by rule engine UPSERT
  fuel_pct NUMERIC(5, 2),
  engine_temp_c NUMERIC(6, 2),
  battery_v NUMERIC(5, 2),
  odometer_km NUMERIC(12, 2),
  heading_deg NUMERIC(6, 2),
  active_alert_count INTEGER NOT NULL DEFAULT 0 CHECK (active_alert_count >= 0),
  maintenance_due BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (vehicle_reg_no ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')
);

INSERT INTO fleet_runtime_state (id, current_mode)
VALUES (1, 'replay')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_depots_city ON depots(city);

CREATE INDEX IF NOT EXISTS idx_routes_city ON routes(city);
CREATE INDEX IF NOT EXISTS idx_routes_depot_id ON routes(depot_id);

CREATE INDEX IF NOT EXISTS idx_drivers_current_safety_score ON drivers(current_safety_score);

CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_depot_status ON vehicles(depot_id, status);

CREATE INDEX IF NOT EXISTS idx_scenario_runs_status_started ON scenario_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_mode_started ON scenario_runs(mode, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_started ON trips(vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status_started ON trips(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_ts ON telemetry_points(vehicle_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_points(ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_mode_ts ON telemetry_points(source_mode, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_scenario_ts ON telemetry_points(scenario_run_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_trip_ts ON telemetry_points(trip_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_vehicle_ts ON events(vehicle_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity_ts ON events(severity, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_mode_ts ON events(source_mode, ts DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON alerts(status, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_created ON alerts(vehicle_id, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type_created ON alerts(alert_type, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_created ON alerts(severity, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_related_event_ids_gin ON alerts USING GIN (related_event_ids);

CREATE INDEX IF NOT EXISTS idx_emitters_type_status_seen ON emitter_heartbeats(vehicle_type, status, last_seen_ts DESC);

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_scope_created ON ai_artifacts(scope_type, scope_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_scenario_created ON ai_artifacts(scenario_run_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_depots_updated_at ON depots;
CREATE TRIGGER trg_depots_updated_at
BEFORE UPDATE ON depots
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_geofences_updated_at ON geofences;
CREATE TRIGGER trg_geofences_updated_at
BEFORE UPDATE ON geofences
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_routes_updated_at ON routes;
CREATE TRIGGER trg_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_drivers_updated_at ON drivers;
CREATE TRIGGER trg_drivers_updated_at
BEFORE UPDATE ON drivers
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_scenario_definitions_updated_at ON scenario_definitions;
CREATE TRIGGER trg_scenario_definitions_updated_at
BEFORE UPDATE ON scenario_definitions
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_scenario_runs_updated_at ON scenario_runs;
CREATE TRIGGER trg_scenario_runs_updated_at
BEFORE UPDATE ON scenario_runs
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_emitters_updated_at ON emitter_heartbeats;
CREATE TRIGGER trg_emitters_updated_at
BEFORE UPDATE ON emitter_heartbeats
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON alerts;
CREATE TRIGGER trg_alerts_updated_at
BEFORE UPDATE ON alerts
FOR EACH ROW EXECUTE FUNCTION fleet.set_alert_updated_timestamps();

DROP TRIGGER IF EXISTS trg_vehicle_latest_state_updated_at ON vehicle_latest_state;
CREATE TRIGGER trg_vehicle_latest_state_updated_at
BEFORE UPDATE ON vehicle_latest_state
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

COMMIT;
