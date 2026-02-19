BEGIN;

SET search_path TO fleet, public;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS planned_eta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT;

CREATE TABLE IF NOT EXISTS trip_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  previous_vehicle_id TEXT REFERENCES vehicles(id),
  previous_driver_id TEXT REFERENCES drivers(id),
  previous_route_id TEXT REFERENCES routes(id),
  new_vehicle_id TEXT REFERENCES vehicles(id),
  new_driver_id TEXT REFERENCES drivers(id),
  new_route_id TEXT REFERENCES routes(id),
  assigned_by TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL CHECK (
    exception_type IN ('sla_delay', 'off_route', 'idle_overrun', 'fuel_anomaly', 'manual_blocker')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACK', 'RESOLVED')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  raised_by TEXT,
  closed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_assignments_trip_assigned ON trip_assignments(trip_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_exceptions_trip_opened ON trip_exceptions(trip_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_exceptions_status_opened ON trip_exceptions(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_exceptions_type_opened ON trip_exceptions(exception_type, opened_at DESC);

DROP TRIGGER IF EXISTS trg_trip_exceptions_updated_at ON trip_exceptions;
CREATE TRIGGER trg_trip_exceptions_updated_at
BEFORE UPDATE ON trip_exceptions
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

COMMIT;
