BEGIN;

SET search_path TO fleet, public;

CREATE TABLE IF NOT EXISTS fuel_events (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  depot_id TEXT REFERENCES depots(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('consumption', 'refuel', 'anomaly')),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  fuel_delta_pct NUMERIC(6, 2) NOT NULL,
  estimated_liters NUMERIC(10, 2),
  anomaly_score NUMERIC(6, 2),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONFIRMED', 'DISMISSED', 'RESOLVED')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  disposition_note TEXT,
  dispositioned_by TEXT,
  dispositioned_at TIMESTAMPTZ,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (event_type <> 'anomaly' OR anomaly_score IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  depot_id TEXT REFERENCES depots(id),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('fuel', 'toll', 'maintenance', 'driver', 'idle', 'other')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  distance_km NUMERIC(10, 2) CHECK (distance_km IS NULL OR distance_km >= 0),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_events_vehicle_ts
  ON fuel_events(vehicle_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_events_status_ts
  ON fuel_events(status, ts DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_events_depot_ts
  ON fuel_events(depot_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_cost_entries_vehicle_ts
  ON cost_entries(vehicle_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_cost_entries_type_ts
  ON cost_entries(cost_type, ts DESC);

CREATE INDEX IF NOT EXISTS idx_cost_entries_depot_ts
  ON cost_entries(depot_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_cost_entries_trip_type
  ON cost_entries(trip_id, cost_type);

DROP TRIGGER IF EXISTS trg_fuel_events_updated_at ON fuel_events;
CREATE TRIGGER trg_fuel_events_updated_at
BEFORE UPDATE ON fuel_events
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_cost_entries_updated_at ON cost_entries;
CREATE TRIGGER trg_cost_entries_updated_at
BEFORE UPDATE ON cost_entries
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    v.vehicle_type,
    v.fuel_capacity_l,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.status,
    t.started_at,
    ROW_NUMBER() OVER (ORDER BY t.started_at DESC, t.id) AS rn
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO fuel_events (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  event_type,
  severity,
  fuel_delta_pct,
  estimated_liters,
  anomaly_score,
  status,
  evidence,
  disposition_note,
  dispositioned_by,
  dispositioned_at,
  ts
)
SELECT
  'fuel-anom-' || st.trip_id,
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'anomaly',
  CASE
    WHEN st.rn % 8 = 0 THEN 'CRITICAL'
    WHEN st.rn % 3 = 0 THEN 'HIGH'
    WHEN st.rn % 2 = 0 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  -1 * (2 + (st.rn % 6))::numeric(6, 2),
  ROUND((st.fuel_capacity_l * ((2 + (st.rn % 6))::numeric / 100.0))::numeric, 2),
  LEAST(99, (55 + st.rn * 3))::numeric(6, 2),
  CASE
    WHEN st.rn % 7 = 0 THEN 'DISMISSED'
    WHEN st.rn % 5 = 0 THEN 'CONFIRMED'
    ELSE 'OPEN'
  END,
  jsonb_build_object(
    'source', 'baseline-seed',
    'expectedDropPct', 1.5,
    'observedDropPct', (2 + (st.rn % 6)),
    'windowMin', (20 + st.rn),
    'tripStatus', st.status,
    'distanceKm', st.distance_km
  ),
  CASE
    WHEN st.rn % 7 = 0 THEN 'sensor jitter dismissed by ops review'
    WHEN st.rn % 5 = 0 THEN 'validated against fuel card transaction'
    ELSE NULL
  END,
  CASE
    WHEN st.rn % 7 = 0 THEN 'ops-analyst'
    WHEN st.rn % 5 = 0 THEN 'ops-supervisor'
    ELSE NULL
  END,
  CASE
    WHEN st.rn % 7 = 0 OR st.rn % 5 = 0 THEN st.started_at + INTERVAL '90 minutes'
    ELSE NULL
  END,
  st.started_at + INTERVAL '20 minutes'
FROM seeded_trips st
WHERE st.rn <= 18
ON CONFLICT (id) DO NOTHING;

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    v.vehicle_type,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.status,
    t.started_at,
    ROW_NUMBER() OVER (ORDER BY t.started_at DESC, t.id) AS rn
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  distance_km,
  ts,
  metadata
)
SELECT
  'cost-' || st.trip_id || '-fuel',
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'fuel',
  ROUND((GREATEST(st.distance_km, 10) *
    CASE st.vehicle_type
      WHEN 'truck' THEN 7.8
      WHEN 'van' THEN 5.1
      ELSE 3.4
    END
  )::numeric, 2),
  st.distance_km,
  st.started_at + INTERVAL '2 hours',
  jsonb_build_object('seed', '0005_fuel_costs', 'basis', 'distance*vehicle_rate')
FROM seeded_trips st
WHERE st.distance_km > 0
ON CONFLICT (id) DO NOTHING;

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.started_at
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  ts,
  metadata
)
SELECT
  'cost-' || st.trip_id || '-driver',
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'driver',
  ROUND((GREATEST(st.distance_km, 8) * 2.1)::numeric, 2),
  st.started_at + INTERVAL '2 hours 10 minutes',
  jsonb_build_object('seed', '0005_fuel_costs', 'basis', 'distance*driver_rate')
FROM seeded_trips st
ON CONFLICT (id) DO NOTHING;

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    v.vehicle_type,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.started_at
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  ts,
  metadata
)
SELECT
  'cost-' || st.trip_id || '-toll',
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'toll',
  ROUND((GREATEST(st.distance_km, 5) *
    CASE st.vehicle_type
      WHEN 'truck' THEN 1.4
      WHEN 'van' THEN 1.0
      ELSE 0.6
    END
  )::numeric, 2),
  st.started_at + INTERVAL '2 hours 20 minutes',
  jsonb_build_object('seed', '0005_fuel_costs', 'basis', 'distance*toll_rate')
FROM seeded_trips st
ON CONFLICT (id) DO NOTHING;

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.status,
    t.started_at,
    ROW_NUMBER() OVER (ORDER BY t.started_at DESC, t.id) AS rn
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  ts,
  metadata
)
SELECT
  'cost-' || st.trip_id || '-idle',
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'idle',
  CASE
    WHEN st.status = 'cancelled' THEN 520.00
    WHEN st.status IN ('planned', 'active', 'paused') THEN 390.00
    ELSE ROUND((GREATEST(st.distance_km, 5) * 0.85)::numeric, 2)
  END,
  st.started_at + INTERVAL '2 hours 30 minutes',
  jsonb_build_object('seed', '0005_fuel_costs', 'basis', 'idle-time estimate', 'rank', st.rn)
FROM seeded_trips st
ON CONFLICT (id) DO NOTHING;

WITH seeded_trips AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    v.depot_id,
    COALESCE(t.actual_distance_km, t.planned_distance_km, 0)::numeric(10, 2) AS distance_km,
    t.started_at,
    ROW_NUMBER() OVER (ORDER BY t.started_at DESC, t.id) AS rn
  FROM trips t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('planned', 'active', 'paused', 'completed', 'cancelled')
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  ts,
  metadata
)
SELECT
  'cost-' || st.trip_id || '-maintenance',
  st.vehicle_id,
  st.trip_id,
  st.depot_id,
  'maintenance',
  ROUND((180 + st.rn * 12)::numeric, 2),
  st.started_at + INTERVAL '3 hours',
  jsonb_build_object('seed', '0005_fuel_costs', 'basis', 'amortized service reserve')
FROM seeded_trips st
WHERE st.rn % 3 = 0
ON CONFLICT (id) DO NOTHING;

WITH depot_overheads AS (
  SELECT
    v.id AS vehicle_id,
    v.depot_id,
    ROW_NUMBER() OVER (ORDER BY v.id) AS rn
  FROM vehicles v
  WHERE v.is_active = TRUE
)
INSERT INTO cost_entries (
  id,
  vehicle_id,
  trip_id,
  depot_id,
  cost_type,
  amount,
  ts,
  notes,
  metadata
)
SELECT
  'cost-overhead-' || d.vehicle_id,
  d.vehicle_id,
  NULL,
  d.depot_id,
  'other',
  ROUND((95 + d.rn * 8)::numeric, 2),
  NOW() - INTERVAL '2 days',
  'Depot overhead allocation',
  jsonb_build_object('seed', '0005_fuel_costs', 'category', 'overhead')
FROM depot_overheads d
WHERE d.rn <= 10
ON CONFLICT (id) DO NOTHING;

COMMIT;
