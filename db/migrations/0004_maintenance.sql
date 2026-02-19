BEGIN;

SET search_path TO fleet, public;

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  interval_km NUMERIC(10, 2) NOT NULL CHECK (interval_km > 0),
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  last_service_at TIMESTAMPTZ,
  last_service_odometer_km NUMERIC(12, 2),
  next_due_date DATE NOT NULL,
  next_due_odometer_km NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  maintenance_plan_id UUID REFERENCES maintenance_plans(id),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  title TEXT NOT NULL,
  description TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  opened_by TEXT,
  assigned_to TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (closed_at IS NULL OR resolved_at IS NOT NULL),
  CHECK (resolved_at IS NULL OR started_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_due
  ON maintenance_plans(next_due_date, next_due_odometer_km);

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_status
  ON work_orders(vehicle_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_status_priority
  ON work_orders(status, priority, opened_at DESC);

DROP TRIGGER IF EXISTS trg_maintenance_plans_updated_at ON maintenance_plans;
CREATE TRIGGER trg_maintenance_plans_updated_at
BEFORE UPDATE ON maintenance_plans
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_orders_updated_at ON work_orders;
CREATE TRIGGER trg_work_orders_updated_at
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

INSERT INTO maintenance_plans (
  vehicle_id,
  interval_km,
  interval_days,
  last_service_at,
  last_service_odometer_km,
  next_due_date,
  next_due_odometer_km,
  notes
)
SELECT
  v.id,
  CASE
    WHEN v.vehicle_type = 'truck' THEN 12000
    WHEN v.vehicle_type = 'van' THEN 10000
    ELSE 8000
  END::numeric(10, 2) AS interval_km,
  CASE
    WHEN v.vehicle_type = 'truck' THEN 45
    WHEN v.vehicle_type = 'van' THEN 35
    ELSE 30
  END AS interval_days,
  NOW() - INTERVAL '20 days' AS last_service_at,
  v.initial_odometer_km,
  (CURRENT_DATE + INTERVAL '10 days')::date AS next_due_date,
  (
    v.initial_odometer_km + CASE
      WHEN v.vehicle_type = 'truck' THEN 12000
      WHEN v.vehicle_type = 'van' THEN 10000
      ELSE 8000
    END
  )::numeric(12, 2) AS next_due_odometer_km,
  'Auto-created baseline maintenance plan'
FROM vehicles v
WHERE v.is_active = TRUE
ON CONFLICT (vehicle_id) DO NOTHING;

COMMIT;
