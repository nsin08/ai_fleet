-- ============================================================================
-- Seed: 005_maintenance_calibration
-- Calibrates maintenance_plans to realistic, varied urgency levels.
-- Sets next_due_odometer_km relative to each vehicle's actual current odometer
-- and next_due_date relative to today, giving a mix of CRITICAL / HIGH /
-- MEDIUM / LOW across the fleet.
--
-- Distribution (urgency driven by BOTH km and date consistently):
--   CRITICAL: mum-01, mum-03, mum-07, del-02     (overdue km AND date)
--   HIGH:     mum-02, mum-04, del-03              (within 3 days AND 500 km)
--   MEDIUM:   mum-05, mum-08, del-04, del-05      (4–7 days AND 500–1500 km)
--   LOW:      mum-06, del-01, del-06              (>7 days AND >1500 km)
-- ============================================================================

SET search_path TO fleet, public;

INSERT INTO seed_batches (id, seed_version, seed_rng, notes)
VALUES (
  gen_random_uuid(),
  '005_maintenance_calibration',
  101,
  'Calibrate maintenance plans: varied urgency, relative km/date offsets'
)
ON CONFLICT (seed_version) DO NOTHING;

-- Update plans using vehicle-specific offsets relative to current live state.
-- km_offset < 0 = already overdue by that many km.
-- day_offset < 0 = due date already passed.
UPDATE fleet.maintenance_plans mp
SET
  next_due_odometer_km = src.new_km,
  next_due_date        = src.new_date,
  last_service_at      = NOW() - INTERVAL '30 days',
  last_service_odometer_km = GREATEST(src.current_km - 12500.0, 0.0),
  interval_km          = 12500,
  interval_days        = 180,
  updated_at           = NOW()
FROM (
  SELECT
    mp2.vehicle_id,
    COALESCE(vls.odometer_km, v.initial_odometer_km) AS current_km,
    -- next_due = current + km_offset (negative = already overdue)
    COALESCE(vls.odometer_km, v.initial_odometer_km) + CASE mp2.vehicle_id
      WHEN 'veh-mum-01' THEN  -1250.0   -- CRITICAL
      WHEN 'veh-mum-02' THEN    340.0   -- HIGH
      WHEN 'veh-mum-03' THEN   -380.0   -- CRITICAL
      WHEN 'veh-mum-04' THEN    220.0   -- HIGH
      WHEN 'veh-mum-05' THEN    820.0   -- MEDIUM
      WHEN 'veh-mum-06' THEN   4200.0   -- LOW
      WHEN 'veh-mum-07' THEN   -920.0   -- CRITICAL
      WHEN 'veh-mum-08' THEN   1100.0   -- MEDIUM
      WHEN 'veh-del-01' THEN   6800.0   -- LOW
      WHEN 'veh-del-02' THEN   -620.0   -- CRITICAL
      WHEN 'veh-del-03' THEN    450.0   -- HIGH
      WHEN 'veh-del-04' THEN    950.0   -- MEDIUM
      WHEN 'veh-del-05' THEN    680.0   -- MEDIUM
      WHEN 'veh-del-06' THEN   3500.0   -- LOW
      ELSE 2500.0
    END AS new_km,
    -- next_due_date = today + day_offset
    CURRENT_DATE + CASE mp2.vehicle_id
      WHEN 'veh-mum-01' THEN  -3   -- CRITICAL: 3 days overdue
      WHEN 'veh-mum-02' THEN   2   -- HIGH: 2 days away
      WHEN 'veh-mum-03' THEN  -1   -- CRITICAL: 1 day overdue
      WHEN 'veh-mum-04' THEN   1   -- HIGH: tomorrow
      WHEN 'veh-mum-05' THEN   6   -- MEDIUM: 6 days
      WHEN 'veh-mum-06' THEN  18   -- LOW: 18 days
      WHEN 'veh-mum-07' THEN  -5   -- CRITICAL: 5 days overdue
      WHEN 'veh-mum-08' THEN   7   -- MEDIUM: 7 days
      WHEN 'veh-del-01' THEN  22   -- LOW: 22 days
      WHEN 'veh-del-02' THEN  -2   -- CRITICAL: 2 days overdue
      WHEN 'veh-del-03' THEN   3   -- HIGH: 3 days
      WHEN 'veh-del-04' THEN   5   -- MEDIUM: 5 days
      WHEN 'veh-del-05' THEN   4   -- MEDIUM: 4 days
      WHEN 'veh-del-06' THEN  25   -- LOW: 25 days
      ELSE 10
    END AS new_date
  FROM fleet.maintenance_plans mp2
  JOIN fleet.vehicles v ON v.id = mp2.vehicle_id
  LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = mp2.vehicle_id
) src
WHERE mp.vehicle_id = src.vehicle_id;
