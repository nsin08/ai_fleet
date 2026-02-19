BEGIN;

SET search_path TO fleet, public;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'on_trip', 'off_shift', 'leave')),
  ADD COLUMN IF NOT EXISTS shift_start_local TIME,
  ADD COLUMN IF NOT EXISTS shift_end_local TIME,
  ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_drivers_availability_status
  ON drivers(availability_status, is_active);

UPDATE drivers
SET
  shift_start_local = COALESCE(shift_start_local, TIME '08:00'),
  shift_end_local = COALESCE(shift_end_local, TIME '18:00')
WHERE is_active = TRUE;

-- Seed realistic non-assignable examples for ops filtering demos.
UPDATE drivers
SET availability_status = 'off_shift',
    availability_updated_at = NOW()
WHERE id IN ('drv-mum-08', 'drv-del-06');

-- Keep availability coherent with active trips:
-- if a driver has an active/planned/paused trip -> on_trip
-- otherwise stale on_trip is downgraded to available.
UPDATE drivers d
SET
  availability_status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM trips t
      WHERE t.driver_id = d.id
        AND t.status IN ('planned', 'active', 'paused')
    ) THEN 'on_trip'
    WHEN d.availability_status = 'on_trip' THEN 'available'
    ELSE d.availability_status
  END,
  availability_updated_at = NOW()
WHERE d.is_active = TRUE;

COMMIT;
