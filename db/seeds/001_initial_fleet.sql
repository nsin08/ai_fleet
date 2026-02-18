-- =============================================================================
-- Seed: 001_initial_fleet
-- Mumbai + Delhi depots, drivers, vehicles, routes
-- =============================================================================

SET search_path TO fleet, public;

-- ----------------------------------------------------------------------------
-- seed_batches: idempotent guard
-- ----------------------------------------------------------------------------
INSERT INTO seed_batches (id, seed_version, seed_rng, notes)
VALUES (
  gen_random_uuid(),
  '001_initial_fleet',
  42,
  'Initial demo fleet: Mumbai depot (8 vehicles) + Delhi depot (6 vehicles)'
)
ON CONFLICT (seed_version) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Depots
-- ----------------------------------------------------------------------------
INSERT INTO depots (id, name, city, state_code, lat, lng, radius_km) VALUES
  ('depot-mum-01', 'Mumbai Central Depot',  'Mumbai', 'MH', 19.076090,  72.877426, 2.5),
  ('depot-del-01', 'Delhi North Depot',     'Delhi',  'DL', 28.704060,  77.102493, 3.0)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Geofences (one per depot)
-- ----------------------------------------------------------------------------
INSERT INTO geofences (id, name, fence_type, depot_id, city, center_lat, center_lng, radius_km) VALUES
  ('gf-mum-01', 'Mumbai Depot Zone',  'circle', 'depot-mum-01', 'Mumbai', 19.076090,  72.877426, 2.5),
  ('gf-del-01', 'Delhi Depot Zone',   'circle', 'depot-del-01', 'Delhi',  28.704060,  77.102493, 3.0)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Routes
-- ----------------------------------------------------------------------------
INSERT INTO routes (id, name, city, depot_id, route_kind, distance_km, estimated_duration_sec) VALUES
  ('route-mum-01', 'Mumbai Port Loop',      'Mumbai', 'depot-mum-01', 'loop',  42.5, 5400),
  ('route-mum-02', 'Mumbai North Corridor', 'Mumbai', 'depot-mum-01', 'loop',  35.0, 4200),
  ('route-del-01', 'Delhi Ring Express',    'Delhi',  'depot-del-01', 'loop',  55.0, 6600),
  ('route-del-02', 'Delhi South Cross',     'Delhi',  'depot-del-01', 'loop',  48.0, 5800)
ON CONFLICT (id) DO NOTHING;

-- Route points (simplified bounding box corners for each route)
INSERT INTO route_points (route_id, seq, lat, lng) VALUES
  ('route-mum-01', 0, 19.076090,  72.877426),
  ('route-mum-01', 1, 19.085000,  72.890000),
  ('route-mum-01', 2, 19.060000,  72.895000),
  ('route-mum-01', 3, 19.055000,  72.870000),

  ('route-mum-02', 0, 19.076090,  72.877426),
  ('route-mum-02', 1, 19.120000,  72.850000),
  ('route-mum-02', 2, 19.140000,  72.860000),
  ('route-mum-02', 3, 19.130000,  72.880000),

  ('route-del-01', 0, 28.704060,  77.102493),
  ('route-del-01', 1, 28.730000,  77.120000),
  ('route-del-01', 2, 28.720000,  77.150000),
  ('route-del-01', 3, 28.690000,  77.140000),

  ('route-del-02', 0, 28.704060,  77.102493),
  ('route-del-02', 1, 28.680000,  77.090000),
  ('route-del-02', 2, 28.660000,  77.100000),
  ('route-del-02', 3, 28.670000,  77.120000)
ON CONFLICT (route_id, seq) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Drivers  (14 total: 8 Mumbai, 6 Delhi)
-- ----------------------------------------------------------------------------
INSERT INTO drivers (id, name, license_id, base_safety_score, current_safety_score, phone) VALUES
  -- Mumbai
  ('drv-mum-01', 'Arjun Sharma',    'MH-14-2019-0012345', 88, 88, '+91-9820001001'),
  ('drv-mum-02', 'Priya Nair',      'MH-14-2020-0023456', 82, 79, '+91-9820001002'),
  ('drv-mum-03', 'Rajesh Patil',    'MH-14-2018-0034567', 91, 90, '+91-9820001003'),
  ('drv-mum-04', 'Sunita Desai',    'MH-14-2021-0045678', 75, 73, '+91-9820001004'),
  ('drv-mum-05', 'Vikram Joshi',    'MH-14-2017-0056789', 94, 92, '+91-9820001005'),
  ('drv-mum-06', 'Kavita Mehta',    'MH-14-2022-0067890', 80, 78, '+91-9820001006'),
  ('drv-mum-07', 'Suresh Yadav',    'MH-14-2019-0078901', 86, 85, '+91-9820001007'),
  ('drv-mum-08', 'Deepa Kulkarni',  'MH-14-2020-0089012', 79, 77, '+91-9820001008'),
  -- Delhi
  ('drv-del-01', 'Amit Kumar',      'DL-14-2018-0112233', 89, 87, '+91-9810001001'),
  ('drv-del-02', 'Neha Gupta',      'DL-14-2020-0223344', 83, 82, '+91-9810001002'),
  ('drv-del-03', 'Rohit Verma',     'DL-14-2019-0334455', 77, 74, '+91-9810001003'),
  ('drv-del-04', 'Anita Singh',     'DL-14-2021-0445566', 92, 91, '+91-9810001004'),
  ('drv-del-05', 'Sanjay Mishra',   'DL-14-2017-0556677', 85, 84, '+91-9810001005'),
  ('drv-del-06', 'Pooja Sharma',    'DL-14-2022-0667788', 78, 76, '+91-9810001006')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Vehicles  (reg_no pattern: XX00XX0000 — 2 alpha, 2 digit, 1-2 alpha, 4 digit)
-- Mumbai: MH04 prefix  |  Delhi: DL05 prefix
-- ----------------------------------------------------------------------------
INSERT INTO vehicles (id, vehicle_reg_no, name, vehicle_type, depot_id, fuel_capacity_l, initial_odometer_km, device_id, model, manufacture_year, status) VALUES
  -- Mumbai trucks
  ('veh-mum-01', 'MH04AB1001', 'Mumbai Truck 01', 'truck', 'depot-mum-01', 300.0,  12450.0, 'dev-mum-0001', 'Tata Prima 4028.S',  2021, 'idle'),
  ('veh-mum-02', 'MH04AB1002', 'Mumbai Truck 02', 'truck', 'depot-mum-01', 300.0,   9810.0, 'dev-mum-0002', 'Tata Prima 4028.S',  2021, 'parked'),
  ('veh-mum-03', 'MH04AB1003', 'Mumbai Truck 03', 'truck', 'depot-mum-01', 300.0,  21000.0, 'dev-mum-0003', 'Ashok Leyland 3518', 2020, 'idle'),
  -- Mumbai vans
  ('veh-mum-04', 'MH04CD2001', 'Mumbai Van 01',   'van',   'depot-mum-01', 120.0,   5600.0, 'dev-mum-0004', 'Force Traveller 26', 2022, 'idle'),
  ('veh-mum-05', 'MH04CD2002', 'Mumbai Van 02',   'van',   'depot-mum-01', 120.0,   8200.0, 'dev-mum-0005', 'Force Traveller 26', 2022, 'parked'),
  ('veh-mum-06', 'MH04CD2003', 'Mumbai Van 03',   'van',   'depot-mum-01', 120.0,  14300.0, 'dev-mum-0006', 'Tata Ace Gold',      2021, 'idle'),
  -- Mumbai cars
  ('veh-mum-07', 'MH04EF3001', 'Mumbai Car 01',   'car',   'depot-mum-01',  50.0,   3200.0, 'dev-mum-0007', 'Maruti Dzire',       2023, 'idle'),
  ('veh-mum-08', 'MH04EF3002', 'Mumbai Car 02',   'car',   'depot-mum-01',  50.0,   6700.0, 'dev-mum-0008', 'Hyundai Aura',       2022, 'parked'),
  -- Delhi trucks
  ('veh-del-01', 'DL05GH4001', 'Delhi Truck 01',  'truck', 'depot-del-01', 300.0,  18000.0, 'dev-del-0001', 'Tata Prima 4028.S',  2020, 'idle'),
  ('veh-del-02', 'DL05GH4002', 'Delhi Truck 02',  'truck', 'depot-del-01', 300.0,  25500.0, 'dev-del-0002', 'Ashok Leyland 3518', 2019, 'parked'),
  -- Delhi vans
  ('veh-del-03', 'DL05JK5001', 'Delhi Van 01',    'van',   'depot-del-01', 120.0,  11200.0, 'dev-del-0003', 'Force Traveller 26', 2021, 'idle'),
  ('veh-del-04', 'DL05JK5002', 'Delhi Van 02',    'van',   'depot-del-01', 120.0,   7400.0, 'dev-del-0004', 'Tata Ace Gold',      2022, 'idle'),
  -- Delhi cars
  ('veh-del-05', 'DL05MN6001', 'Delhi Car 01',    'car',   'depot-del-01',  50.0,   4100.0, 'dev-del-0005', 'Maruti Dzire',       2023, 'idle'),
  ('veh-del-06', 'DL05MN6002', 'Delhi Car 02',    'car',   'depot-del-01',  50.0,   9300.0, 'dev-del-0006', 'Honda City',         2022, 'parked')
ON CONFLICT (id) DO NOTHING;
