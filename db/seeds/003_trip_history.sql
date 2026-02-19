-- =============================================================================
-- Seed: 003_trip_history
-- Demo trip history + stop history for dashboard/vehicle detail.
-- =============================================================================

SET search_path TO fleet, public;

INSERT INTO seed_batches (id, seed_version, seed_rng, notes)
VALUES (
  gen_random_uuid(),
  '003_trip_history',
  77,
  'Trip history for fleet dashboard and vehicle detail pages'
)
ON CONFLICT (seed_version) DO NOTHING;

INSERT INTO trips (
  id, vehicle_id, driver_id, route_id, scenario_run_id, status,
  started_at, ended_at, start_depot_id, end_depot_id,
  planned_distance_km, actual_distance_km, end_reason
) VALUES
  ('trip-mum-veh01-001', 'veh-mum-01', 'drv-mum-01', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '3 day 5 hour', NOW() - INTERVAL '3 day 3 hour 30 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 44.1, 'completed'),
  ('trip-mum-veh01-002', 'veh-mum-01', 'drv-mum-07', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '2 day 4 hour', NOW() - INTERVAL '2 day 2 hour 40 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 34.8, 'completed'),
  ('trip-mum-veh04-001', 'veh-mum-04', 'drv-mum-04', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '1 day 8 hour', NOW() - INTERVAL '1 day 6 hour 15 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 43.0, 'completed'),
  ('trip-mum-veh06-001', 'veh-mum-06', 'drv-mum-06', 'route-mum-02', NULL, 'cancelled',
   NOW() - INTERVAL '1 day 3 hour', NOW() - INTERVAL '1 day 2 hour 20 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 11.2, 'mechanical issue'),
  ('trip-del-veh01-001', 'veh-del-01', 'drv-del-01', 'route-del-01', NULL, 'completed',
   NOW() - INTERVAL '4 day 7 hour', NOW() - INTERVAL '4 day 4 hour 45 min',
   'depot-del-01', 'depot-del-01', 55.0, 57.4, 'completed'),
  ('trip-del-veh03-001', 'veh-del-03', 'drv-del-03', 'route-del-02', NULL, 'completed',
   NOW() - INTERVAL '2 day 7 hour', NOW() - INTERVAL '2 day 5 hour 10 min',
   'depot-del-01', 'depot-del-01', 48.0, 49.3, 'completed'),
  ('trip-del-veh04-001', 'veh-del-04', 'drv-del-05', 'route-del-02', NULL, 'completed',
   NOW() - INTERVAL '20 hour', NOW() - INTERVAL '18 hour 10 min',
   'depot-del-01', 'depot-del-01', 48.0, 46.7, 'completed'),
  ('trip-del-veh05-001', 'veh-del-05', 'drv-del-02', 'route-del-01', NULL, 'completed',
   NOW() - INTERVAL '16 hour', NOW() - INTERVAL '14 hour 30 min',
   'depot-del-01', 'depot-del-01', 55.0, 53.8, 'completed'),
  ('trip-del-veh06-001', 'veh-del-06', 'drv-del-06', 'route-del-01', NULL, 'completed',
   NOW() - INTERVAL '11 hour', NOW() - INTERVAL '9 hour 40 min',
   'depot-del-01', 'depot-del-01', 55.0, 56.0, 'completed'),
  ('trip-active-veh03', 'veh-mum-03', 'drv-mum-03', 'route-mum-01', NULL, 'active',
   NOW() - INTERVAL '35 min', NULL,
   'depot-mum-01', NULL, 42.5, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_stops (
  trip_id, seq, stop_type, lat, lng, arrived_at, departed_at, reason
) VALUES
  ('trip-mum-veh01-001', 0, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '3 day 5 hour', NOW() - INTERVAL '3 day 4 hour 57 min', 'start'),
  ('trip-mum-veh01-001', 1, 'traffic',  19.085000, 72.890000, NOW() - INTERVAL '3 day 4 hour 20 min', NOW() - INTERVAL '3 day 4 hour 12 min', 'city congestion'),
  ('trip-mum-veh01-001', 2, 'delivery', 19.060000, 72.895000, NOW() - INTERVAL '3 day 3 hour 58 min', NOW() - INTERVAL '3 day 3 hour 43 min', 'drop-off'),
  ('trip-mum-veh01-001', 3, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '3 day 3 hour 32 min', NOW() - INTERVAL '3 day 3 hour 30 min', 'end'),

  ('trip-mum-veh01-002', 0, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '2 day 4 hour', NOW() - INTERVAL '2 day 3 hour 58 min', 'start'),
  ('trip-mum-veh01-002', 1, 'delivery', 19.120000, 72.850000, NOW() - INTERVAL '2 day 3 hour 22 min', NOW() - INTERVAL '2 day 3 hour 6 min', 'warehouse stop'),
  ('trip-mum-veh01-002', 2, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '2 day 2 hour 42 min', NOW() - INTERVAL '2 day 2 hour 40 min', 'end'),

  ('trip-mum-veh04-001', 0, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '1 day 8 hour', NOW() - INTERVAL '1 day 7 hour 58 min', 'start'),
  ('trip-mum-veh04-001', 1, 'break',    19.085000, 72.890000, NOW() - INTERVAL '1 day 7 hour 6 min', NOW() - INTERVAL '1 day 6 hour 58 min', 'driver break'),
  ('trip-mum-veh04-001', 2, 'depot',    19.076090, 72.877426, NOW() - INTERVAL '1 day 6 hour 17 min', NOW() - INTERVAL '1 day 6 hour 15 min', 'end'),

  ('trip-del-veh01-001', 0, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '4 day 7 hour', NOW() - INTERVAL '4 day 6 hour 58 min', 'start'),
  ('trip-del-veh01-001', 1, 'delivery', 28.730000, 77.120000, NOW() - INTERVAL '4 day 6 hour 5 min', NOW() - INTERVAL '4 day 5 hour 42 min', 'logistics hub'),
  ('trip-del-veh01-001', 2, 'traffic',  28.720000, 77.150000, NOW() - INTERVAL '4 day 5 hour 18 min', NOW() - INTERVAL '4 day 5 hour 6 min', 'ring road'),
  ('trip-del-veh01-001', 3, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '4 day 4 hour 47 min', NOW() - INTERVAL '4 day 4 hour 45 min', 'end'),

  ('trip-del-veh03-001', 0, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '2 day 7 hour', NOW() - INTERVAL '2 day 6 hour 58 min', 'start'),
  ('trip-del-veh03-001', 1, 'delivery', 28.680000, 77.090000, NOW() - INTERVAL '2 day 6 hour 25 min', NOW() - INTERVAL '2 day 6 hour 9 min', 'consignment drop'),
  ('trip-del-veh03-001', 2, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '2 day 5 hour 12 min', NOW() - INTERVAL '2 day 5 hour 10 min', 'end'),

  ('trip-del-veh04-001', 0, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '20 hour', NOW() - INTERVAL '19 hour 58 min', 'start'),
  ('trip-del-veh04-001', 1, 'delivery', 28.660000, 77.100000, NOW() - INTERVAL '19 hour 15 min', NOW() - INTERVAL '18 hour 54 min', 'parcel handoff'),
  ('trip-del-veh04-001', 2, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '18 hour 12 min', NOW() - INTERVAL '18 hour 10 min', 'end'),

  ('trip-del-veh05-001', 0, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '16 hour', NOW() - INTERVAL '15 hour 58 min', 'start'),
  ('trip-del-veh05-001', 1, 'delivery', 28.730000, 77.120000, NOW() - INTERVAL '15 hour 12 min', NOW() - INTERVAL '14 hour 52 min', 'commercial pickup'),
  ('trip-del-veh05-001', 2, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '14 hour 32 min', NOW() - INTERVAL '14 hour 30 min', 'end'),

  ('trip-del-veh06-001', 0, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '11 hour', NOW() - INTERVAL '10 hour 58 min', 'start'),
  ('trip-del-veh06-001', 1, 'traffic',  28.720000, 77.150000, NOW() - INTERVAL '10 hour 16 min', NOW() - INTERVAL '10 hour 5 min', 'traffic stop'),
  ('trip-del-veh06-001', 2, 'depot',    28.704060, 77.102493, NOW() - INTERVAL '9 hour 42 min', NOW() - INTERVAL '9 hour 40 min', 'end'),

  ('trip-active-veh03', 0, 'depot',     19.076090, 72.877426, NOW() - INTERVAL '35 min', NOW() - INTERVAL '33 min', 'start'),
  ('trip-active-veh03', 1, 'traffic',   19.085000, 72.890000, NOW() - INTERVAL '10 min', NULL, 'slow corridor')
ON CONFLICT (trip_id, seq) DO NOTHING;

UPDATE vehicles
SET status = 'on_trip'
WHERE id = 'veh-mum-03';
