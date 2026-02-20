-- ============================================================================
-- Seed: 004_historical_data
-- 7 days of rich historical data:
--   • Route waypoints updated to follow real road corridors (Mumbai & Delhi)
--   • 15 additional trips spread across all vehicles for full fleet coverage
--   • Dense telemetry interpolated along route path (every 90 s per trip)
--   • 15 historical events (OVERSPEED, HARSH_BRAKE, FUEL_ANOMALY, etc.)
--   • 15 alerts: 5 OPEN · 3 ACK · 7 CLOSED
--   • 3 fuel anomaly events in fuel_events
-- ============================================================================

SET search_path TO fleet, public;

INSERT INTO seed_batches (id, seed_version, seed_rng, notes)
VALUES (
  gen_random_uuid(),
  '004_historical_data',
  99,
  '7-day history: real road waypoints, dense telemetry, events, alerts'
)
ON CONFLICT (seed_version) DO NOTHING;

-- ============================================================================
-- SECTION 1 — Route waypoints with real road paths
-- Replaces the original simple 4-corner bounding-box waypoints.
-- Mumbai: depot at BKC/Mahim area (19.0761, 72.8774)
-- Delhi:  depot at Rohini North   (28.7041, 77.1025)
-- ============================================================================

-- ── Mumbai Port Loop ~42 km — eastern industrial loop via EEH/LBS/JVLR ──────
INSERT INTO route_points (route_id, seq, lat, lng) VALUES
  ('route-mum-01',  0, 19.076090, 72.877426),  -- BKC depot
  ('route-mum-01',  1, 19.070200, 72.881200),  -- Dharavi Main Rd
  ('route-mum-01',  2, 19.063800, 72.885600),  -- Sion flyover
  ('route-mum-01',  3, 19.058900, 72.890100),  -- Sion-Panvel Hwy on-ramp
  ('route-mum-01',  4, 19.051200, 72.897800),  -- Kurla East / LBS Marg
  ('route-mum-01',  5, 19.044500, 72.903400),  -- Kurla Station Rd
  ('route-mum-01',  6, 19.037800, 72.911200),  -- Ghatkopar W bridge
  ('route-mum-01',  7, 19.029800, 72.918900),  -- Ghatkopar E junction
  ('route-mum-01',  8, 19.021200, 72.925600),  -- Vikhroli (P)
  ('route-mum-01',  9, 19.013400, 72.931200),  -- Bhandup West
  ('route-mum-01', 10, 18.999800, 72.936500),  -- Mulund West
  ('route-mum-01', 11, 18.994500, 72.944800),  -- Thane Creek Freeway
  ('route-mum-01', 12, 19.008900, 72.949200),  -- Airoli (Navi Mumbai)
  ('route-mum-01', 13, 19.023400, 72.942300),  -- Ghansoli
  ('route-mum-01', 14, 19.040600, 72.929800),  -- Kopar Khairane
  ('route-mum-01', 15, 19.057800, 72.910200),  -- Turbhe / JVLR west
  ('route-mum-01', 16, 19.069100, 72.894500),  -- Powai / JVLR east
  ('route-mum-01', 17, 19.076090, 72.877426)   -- BKC depot
ON CONFLICT (route_id, seq) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ── Mumbai North Corridor ~35 km — WEH north to Kandivali and back ──────────
INSERT INTO route_points (route_id, seq, lat, lng) VALUES
  ('route-mum-02',  0, 19.076090, 72.877426),  -- BKC depot
  ('route-mum-02',  1, 19.083400, 72.871200),  -- Bandra East / WEH south
  ('route-mum-02',  2, 19.095600, 72.864500),  -- Santacruz East
  ('route-mum-02',  3, 19.108900, 72.854600),  -- Vile Parle East
  ('route-mum-02',  4, 19.121200, 72.841200),  -- Andheri East flyover
  ('route-mum-02',  5, 19.137800, 72.835600),  -- Jogeshwari East
  ('route-mum-02',  6, 19.151200, 72.834300),  -- Goregaon East / WEH
  ('route-mum-02',  7, 19.168900, 72.831200),  -- Malad East
  ('route-mum-02',  8, 19.181200, 72.822300),  -- Kandivali East (turnaround)
  ('route-mum-02',  9, 19.171200, 72.826700),  -- Kandivali WEH southbound
  ('route-mum-02', 10, 19.154500, 72.841200),  -- Goregaon WEH south
  ('route-mum-02', 11, 19.138900, 72.845600),  -- Jogeshwari WEH south
  ('route-mum-02', 12, 19.121200, 72.848900),  -- Andheri West
  ('route-mum-02', 13, 19.104500, 72.857800),  -- Santacruz West
  ('route-mum-02', 14, 19.086700, 72.871200),  -- Bandra West
  ('route-mum-02', 15, 19.076090, 72.877426)   -- BKC depot
ON CONFLICT (route_id, seq) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ── Delhi Ring Express ~55 km — Outer Ring Rd (north arc) ───────────────────
INSERT INTO route_points (route_id, seq, lat, lng) VALUES
  ('route-del-01',  0, 28.704060, 77.102493),  -- Rohini depot
  ('route-del-01',  1, 28.713400, 77.111200),  -- Rohini Sector 11 T-jn
  ('route-del-01',  2, 28.722300, 77.122300),  -- Pitampura Metro
  ('route-del-01',  3, 28.731200, 77.133400),  -- Rani Bagh crossroads
  ('route-del-01',  4, 28.742300, 77.118900),  -- Ashok Vihar Phase 2
  ('route-del-01',  5, 28.750100, 77.106700),  -- Model Town OH bridge
  ('route-del-01',  6, 28.738900, 77.093400),  -- GTK Road (Ring Rd)
  ('route-del-01',  7, 28.725600, 77.081200),  -- Inderlok T-jn
  ('route-del-01',  8, 28.713400, 77.072300),  -- Subhash Nagar
  ('route-del-01',  9, 28.702300, 77.065600),  -- Rajouri Garden east
  ('route-del-01', 10, 28.691200, 77.074500),  -- Punjabi Bagh west
  ('route-del-01', 11, 28.683400, 77.086700),  -- Madipur (Outer Ring Rd)
  ('route-del-01', 12, 28.682300, 77.102300),  -- Shalimar Bagh South
  ('route-del-01', 13, 28.693400, 77.113400),  -- Keshav Puram
  ('route-del-01', 14, 28.704500, 77.118900),  -- Tri Nagar
  ('route-del-01', 15, 28.715600, 77.114500),  -- Rishi Nagar
  ('route-del-01', 16, 28.704060, 77.102493)   -- Rohini depot
ON CONFLICT (route_id, seq) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ── Delhi South Cross ~48 km — through Central Delhi ────────────────────────
INSERT INTO route_points (route_id, seq, lat, lng) VALUES
  ('route-del-02',  0, 28.704060, 77.102493),  -- Rohini depot
  ('route-del-02',  1, 28.695600, 77.106700),  -- Shastri Nagar North
  ('route-del-02',  2, 28.684500, 77.110200),  -- Shastri Nagar South
  ('route-del-02',  3, 28.671200, 77.097800),  -- Karol Bagh Ring Rd
  ('route-del-02',  4, 28.657800, 77.095600),  -- Rajendra Nagar
  ('route-del-02',  5, 28.645600, 77.092300),  -- Jhandewalan
  ('route-del-02',  6, 28.634500, 77.086700),  -- Connaught Place North
  ('route-del-02',  7, 28.627800, 77.093400),  -- Connaught Place
  ('route-del-02',  8, 28.618900, 77.097800),  -- ITO
  ('route-del-02',  9, 28.608900, 77.105600),  -- Pragati Maidan
  ('route-del-02', 10, 28.597800, 77.113400),  -- Khan Market
  ('route-del-02', 11, 28.586700, 77.121200),  -- AIIMS junction
  ('route-del-02', 12, 28.578900, 77.128900),  -- Hauz Khas
  ('route-del-02', 13, 28.571200, 77.137800),  -- IIT Delhi
  ('route-del-02', 14, 28.573400, 77.114500),  -- Vasant Vihar
  ('route-del-02', 15, 28.586700, 77.106700),  -- R K Puram
  ('route-del-02', 16, 28.603400, 77.098900),  -- Moti Bagh
  ('route-del-02', 17, 28.623400, 77.093400),  -- Rajouri Garden East
  ('route-del-02', 18, 28.642300, 77.096700),  -- Pusa Road
  ('route-del-02', 19, 28.662300, 77.101200),  -- Karol Bagh North
  ('route-del-02', 20, 28.686700, 77.102300),  -- Paharganj
  ('route-del-02', 21, 28.704060, 77.102493)   -- Rohini depot
ON CONFLICT (route_id, seq) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ============================================================================
-- SECTION 2 — Historical trips (15 new trips, all vehicles now covered)
-- Covers vehicles: mum-02,05,07,08 and del-02 which had no prior trip history
-- ============================================================================

INSERT INTO trips (
  id, vehicle_id, driver_id, route_id, scenario_run_id, status,
  started_at, ended_at, start_depot_id, end_depot_id,
  planned_distance_km, actual_distance_km, end_reason
) VALUES
  -- ── Day 7 ───────────────────────────────────────────────────────────────
  ('trip-h-001', 'veh-mum-02', 'drv-mum-02', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '7 days 6 hours', NOW() - INTERVAL '7 days 4 hours 28 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 43.8, 'completed'),

  ('trip-h-002', 'veh-del-02', 'drv-del-02', 'route-del-01', NULL, 'completed',
   NOW() - INTERVAL '7 days 8 hours', NOW() - INTERVAL '7 days 6 hours 5 min',
   'depot-del-01', 'depot-del-01', 55.0, 54.2, 'completed'),

  -- ── Day 6 ───────────────────────────────────────────────────────────────
  ('trip-h-003', 'veh-mum-05', 'drv-mum-05', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '6 days 5 hours', NOW() - INTERVAL '6 days 3 hours 42 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 36.1, 'completed'),

  ('trip-h-004', 'veh-del-02', 'drv-del-04', 'route-del-02', NULL, 'completed',
   NOW() - INTERVAL '6 days 7 hours', NOW() - INTERVAL '6 days 5 hours 28 min',
   'depot-del-01', 'depot-del-01', 48.0, 47.5, 'completed'),

  -- ── Day 5 ───────────────────────────────────────────────────────────────
  ('trip-h-005', 'veh-mum-07', 'drv-mum-07', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 2 hours 32 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 41.9, 'completed'),

  ('trip-h-006', 'veh-del-02', 'drv-del-02', 'route-del-01', NULL, 'completed',
   NOW() - INTERVAL '5 days 6 hours', NOW() - INTERVAL '5 days 3 hours 52 min',
   'depot-del-01', 'depot-del-01', 55.0, 56.3, 'completed'),

  -- ── Day 4 ───────────────────────────────────────────────────────────────
  ('trip-h-007', 'veh-mum-08', 'drv-mum-08', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 1 hour 40 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 34.6, 'completed'),

  -- ── Day 3 ───────────────────────────────────────────────────────────────
  ('trip-h-008', 'veh-mum-02', 'drv-mum-06', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '3 days 2 hours', NOW() - INTERVAL '3 days 0 hours 28 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 35.7, 'completed'),

  ('trip-h-009', 'veh-del-02', 'drv-del-03', 'route-del-02', NULL, 'completed',
   NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 2 hours 10 min',
   'depot-del-01', 'depot-del-01', 48.0, 49.2, 'completed'),

  -- ── Day 2 ───────────────────────────────────────────────────────────────
  ('trip-h-010', 'veh-mum-05', 'drv-mum-05', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '2 days 1 hour', NOW() - INTERVAL '1 day 23 hours 32 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 43.0, 'completed'),

  ('trip-h-011', 'veh-mum-08', 'drv-mum-01', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '2 days 3 hours', NOW() - INTERVAL '2 days 1 hour 45 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 33.8, 'completed'),

  -- ── Day 1 ───────────────────────────────────────────────────────────────
  ('trip-h-012', 'veh-mum-07', 'drv-mum-04', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '23 hours', NOW() - INTERVAL '21 hours 31 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 42.9, 'completed'),

  ('trip-h-013', 'veh-del-02', 'drv-del-04', 'route-del-02', NULL, 'completed',
   NOW() - INTERVAL '14 hours', NOW() - INTERVAL '12 hours 34 min',
   'depot-del-01', 'depot-del-01', 48.0, 48.7, 'completed'),

  -- ── Today ────────────────────────────────────────────────────────────────
  ('trip-h-014', 'veh-mum-02', 'drv-mum-02', 'route-mum-02', NULL, 'completed',
   NOW() - INTERVAL '6 hours', NOW() - INTERVAL '4 hours 28 min',
   'depot-mum-01', 'depot-mum-01', 35.0, 35.4, 'completed'),

  ('trip-h-015', 'veh-mum-05', 'drv-mum-07', 'route-mum-01', NULL, 'completed',
   NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours 29 min',
   'depot-mum-01', 'depot-mum-01', 42.5, 44.2, 'completed')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 3 — Dense telemetry generated via PL/pgSQL
-- Generates a telemetry point every 90 s per trip, interpolating positions
-- linearly along the route waypoints with small GPS jitter.
-- Speed profile: slow at depot ingress/egress, faster on highway stretches.
-- Skips trips that already have telemetry (idempotent).
-- ============================================================================

DO $$
DECLARE
  v_trip      RECORD;
  v_lats      FLOAT8[];
  v_lngs      FLOAT8[];
  v_wp_count  INT;
  v_dur_sec   BIGINT;
  v_n_pts     INT;
  v_interval  INT     := 90;   -- seconds between points
  v_i         INT;
  v_frac      FLOAT8;
  v_seg_idx   INT;
  v_seg_frac  FLOAT8;
  v_lat1 FLOAT8; v_lng1 FLOAT8;
  v_lat2 FLOAT8; v_lng2 FLOAT8;
  v_lat       FLOAT8;
  v_lng       FLOAT8;
  v_ts        TIMESTAMPTZ;
  v_speed     FLOAT8;
  v_fuel      FLOAT8;
  v_odometer  FLOAT8;
  v_heading   FLOAT8;
  v_rpm       INT;
  v_eng_temp  FLOAT8;
BEGIN

  FOR v_trip IN
    SELECT
      t.id               AS trip_id,
      t.vehicle_id,
      v.vehicle_reg_no,
      v.initial_odometer_km,
      t.route_id,
      t.started_at,
      t.ended_at
    FROM fleet.trips t
    JOIN fleet.vehicles v ON v.id = t.vehicle_id
    WHERE t.status      = 'completed'
      AND t.route_id    IS NOT NULL
      AND t.scenario_run_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fleet.telemetry_points tp
        WHERE tp.trip_id = t.id
        LIMIT 1
      )
    ORDER BY t.started_at
  LOOP

    -- Load waypoints into arrays (1-indexed in PL/pgSQL)
    SELECT
      ARRAY(SELECT lat::FLOAT8 FROM fleet.route_points WHERE route_id = v_trip.route_id ORDER BY seq),
      ARRAY(SELECT lng::FLOAT8 FROM fleet.route_points WHERE route_id = v_trip.route_id ORDER BY seq)
    INTO v_lats, v_lngs;

    v_wp_count := array_length(v_lats, 1);
    IF v_wp_count IS NULL OR v_wp_count < 2 THEN CONTINUE; END IF;

    v_dur_sec := EXTRACT(EPOCH FROM (v_trip.ended_at - v_trip.started_at))::BIGINT;
    IF v_dur_sec <= 0 THEN CONTINUE; END IF;

    v_n_pts   := v_dur_sec / v_interval;
    v_fuel    := 72.0 + random() * 18.0;           -- start 72–90 %
    v_odometer := v_trip.initial_odometer_km
                  + 500.0 + random() * 8000.0;     -- accumulated distance offset

    FOR v_i IN 0..v_n_pts LOOP

      v_frac := CASE WHEN v_n_pts = 0 THEN 0.0
                     ELSE v_i::FLOAT8 / v_n_pts END;

      -- Map fraction → waypoint segment
      v_seg_idx  := LEAST(
                      floor(v_frac * (v_wp_count - 1))::INT,
                      v_wp_count - 2
                    );
      v_seg_frac := (v_frac * (v_wp_count - 1)) - v_seg_idx;

      -- PL/pgSQL arrays are 1-indexed
      v_lat1 := v_lats[v_seg_idx + 1];  v_lng1 := v_lngs[v_seg_idx + 1];
      v_lat2 := v_lats[v_seg_idx + 2];  v_lng2 := v_lngs[v_seg_idx + 2];

      -- Linear interpolation + GPS jitter ≈ ±20 m
      v_lat := v_lat1 + (v_lat2 - v_lat1) * v_seg_frac
                      + (random() - 0.5) * 0.0003;
      v_lng := v_lng1 + (v_lng2 - v_lng1) * v_seg_frac
                      + (random() - 0.5) * 0.0003;

      -- Approximate bearing (FLOAT8 → NUMERIC cast required for modulo in PG)
      v_heading := (
        (DEGREES(ATAN2(v_lng2 - v_lng1, v_lat2 - v_lat1)) + 360.0)::NUMERIC
        % 360.0
      )::FLOAT8;

      -- Speed: depot crawl → urban → expressway → urban → depot crawl
      v_speed := CASE
        WHEN v_frac < 0.05 OR v_frac > 0.95 THEN  5.0 + random() * 10.0
        WHEN v_frac < 0.12 OR v_frac > 0.88 THEN 18.0 + random() * 22.0
        WHEN v_frac < 0.25 OR v_frac > 0.75 THEN 35.0 + random() * 25.0
        ELSE                                       48.0 + random() * 32.0
      END;

      v_ts       := v_trip.started_at
                     + (v_dur_sec * v_frac || ' seconds')::INTERVAL;
      v_fuel     := GREATEST(v_fuel - v_speed * 0.00022, 8.0);
      v_odometer := v_odometer + v_speed * v_interval / 3600.0;
      v_rpm      := (v_speed * 22 + 750 + random() * 250)::INT;
      v_eng_temp := 82.0 + random() * 14.0;

      INSERT INTO fleet.telemetry_points (
        vehicle_id, vehicle_reg_no, trip_id, scenario_run_id,
        source_mode, ts, lat, lng,
        speed_kph, ignition, idling,
        fuel_pct, engine_temp_c, battery_v,
        odometer_km, heading_deg, rpm, metadata
      ) VALUES (
        v_trip.vehicle_id,
        v_trip.vehicle_reg_no,
        v_trip.trip_id,
        NULL,
        'replay',
        v_ts,
        ROUND(v_lat::NUMERIC, 6),
        ROUND(v_lng::NUMERIC, 6),
        ROUND(v_speed::NUMERIC, 2),
        TRUE,
        (v_speed < 3.0),
        ROUND(v_fuel::NUMERIC,  2),
        ROUND(v_eng_temp::NUMERIC, 2),
        ROUND((12.6 + random() * 0.6)::NUMERIC, 2),
        ROUND(v_odometer::NUMERIC, 2),
        ROUND(v_heading::NUMERIC, 2),
        v_rpm,
        '{}'::JSONB
      );

    END LOOP;
  END LOOP;

END $$;

-- ============================================================================
-- SECTION 4 — Historical events
-- source_mode = 'replay' (no source_emitter_id required)
-- Severity: LOW | MEDIUM | HIGH  (no CRITICAL in events)
-- ============================================================================

INSERT INTO events (
  id, ts, vehicle_id, vehicle_reg_no, driver_id,
  trip_id, scenario_run_id,
  source_mode, source, event_type, severity, message, metadata
) VALUES

  -- 7 days ago — trip-h-001 (Mumbai Truck 02 on Port Loop)
  ('evt-hist-001',
   NOW() - INTERVAL '7 days 5 hours 15 min',
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-001', NULL,
   'replay', 'rule_engine', 'OVERSPEED', 'HIGH',
   'Vehicle exceeded speed limit: 96 km/h in 60 km/h zone on Eastern Express Hwy',
   '{"limit_kph": 60, "recorded_kph": 96}'::jsonb),

  ('evt-hist-002',
   NOW() - INTERVAL '7 days 4 hours 45 min',
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-001', NULL,
   'replay', 'rule_engine', 'HARSH_BRAKE', 'MEDIUM',
   'Harsh braking detected: deceleration 0.72 g near Ghatkopar junction',
   '{"decel_g": 0.72, "speed_before_kph": 74}'::jsonb),

  -- 7 days ago — trip-h-002 (Delhi Truck 02 on Ring Express)
  ('evt-hist-003',
   NOW() - INTERVAL '7 days 7 hours 30 min',
   'veh-del-02', 'DL05GH4002', 'drv-del-02', 'trip-h-002', NULL,
   'replay', 'rule_engine', 'DTC_FAULT', 'MEDIUM',
   'Engine fault code P0401 — EGR flow insufficient, check at next service',
   '{"dtc_code": "P0401", "description": "EGR Insufficient Flow Detected"}'::jsonb),

  -- 6 days ago — trip-h-003 (Mumbai Van 02 on North Corridor)
  ('evt-hist-004',
   NOW() - INTERVAL '6 days 4 hours 10 min',
   'veh-mum-05', 'MH04CD2002', 'drv-mum-05', 'trip-h-003', NULL,
   'replay', 'rule_engine', 'OVERSPEED', 'MEDIUM',
   'Vehicle exceeded speed limit: 88 km/h in 70 km/h zone on WEH near Andheri',
   '{"limit_kph": 70, "recorded_kph": 88}'::jsonb),

  -- 5 days ago — trip-h-006 (Delhi Truck 02 Port Loop — fuel anomaly)
  ('evt-hist-005',
   NOW() - INTERVAL '5 days 5 hours',
   'veh-del-02', 'DL05GH4002', 'drv-del-02', 'trip-h-006', NULL,
   'replay', 'rule_engine', 'FUEL_ANOMALY', 'HIGH',
   'Unusual fuel drop: -18% in 12 minutes; possible fuel theft near Punjabi Bagh stop',
   '{"fuel_before_pct": 72, "fuel_after_pct": 54, "duration_min": 12}'::jsonb),

  -- 5 days ago — trip-h-005 (Mumbai Van 01 — fatigue)
  ('evt-hist-006',
   NOW() - INTERVAL '5 days 3 hours',
   'veh-mum-07', 'MH04EF3001', 'drv-mum-07', 'trip-h-005', NULL,
   'replay', 'rule_engine', 'FATIGUE', 'HIGH',
   'Driver fatigue alert: shift duration exceeded 8 h without mandatory break',
   '{"shift_hours": 8.4, "break_count": 0}'::jsonb),

  -- 4 days ago — trip-del-veh01-001 (existing trip, Delhi Truck 01)
  ('evt-hist-007',
   NOW() - INTERVAL '4 days 6 hours',
   'veh-del-01', 'DL05GH4001', 'drv-del-01', 'trip-del-veh01-001', NULL,
   'replay', 'rule_engine', 'HARSH_BRAKE', 'HIGH',
   'Harsh braking detected: deceleration 0.91 g on Ring Road near Rajouri Garden',
   '{"decel_g": 0.91, "speed_before_kph": 82}'::jsonb),

  -- 3 days ago — trip-h-009 (Delhi Van 02 South Cross)
  ('evt-hist-008',
   NOW() - INTERVAL '3 days 3 hours',
   'veh-del-02', 'DL05GH4002', 'drv-del-03', 'trip-h-009', NULL,
   'replay', 'rule_engine', 'OFF_ROUTE', 'LOW',
   'Vehicle deviated from planned route near Connaught Place (200 m off path)',
   '{"deviation_m": 200, "duration_sec": 240}'::jsonb),

  -- 3 days ago — trip-mum-veh01-001 (existing trip)
  ('evt-hist-009',
   NOW() - INTERVAL '3 days 4 hours',
   'veh-mum-01', 'MH04AB1001', 'drv-mum-01', 'trip-mum-veh01-001', NULL,
   'replay', 'rule_engine', 'MAINTENANCE_DUE', 'MEDIUM',
   'Scheduled maintenance overdue: odometer at service interval +1 200 km',
   '{"km_overdue": 1200, "last_service_km": 11250}'::jsonb),

  -- 1 day ago — trip-mum-veh06-001 (cancelled trip, van veered off route)
  ('evt-hist-010',
   NOW() - INTERVAL '1 day 2 hours 45 min',
   'veh-mum-06', 'MH04CD2003', 'drv-mum-06', 'trip-mum-veh06-001', NULL,
   'replay', 'rule_engine', 'GEOFENCE_BREACH', 'MEDIUM',
   'Vehicle exited Mumbai Depot Zone geofence without clearance',
   '{"geofence_id": "gf-mum-01", "lat": 19.0685, "lng": 72.8812}'::jsonb),

  -- 2 days ago — trip-h-010 (Mumbai Van 02 Port Loop overspeed)
  ('evt-hist-011',
   NOW() - INTERVAL '2 days 0 hours 15 min',
   'veh-mum-05', 'MH04CD2002', 'drv-mum-05', 'trip-h-010', NULL,
   'replay', 'rule_engine', 'OVERSPEED', 'HIGH',
   'Vehicle exceeded speed limit: 102 km/h in 60 km/h zone near Airoli freeway',
   '{"limit_kph": 60, "recorded_kph": 102}'::jsonb),

  -- 23 hours ago — trip-h-012 (Mumbai Van 01)
  ('evt-hist-012',
   NOW() - INTERVAL '22 hours 15 min',
   'veh-mum-07', 'MH04EF3001', 'drv-mum-04', 'trip-h-012', NULL,
   'replay', 'rule_engine', 'HARSH_BRAKE', 'HIGH',
   'Harsh braking detected: deceleration 0.88 g near Vikhroli flyover',
   '{"decel_g": 0.88, "speed_before_kph": 69}'::jsonb),

  -- 13 hours ago — trip-h-013 (Delhi Truck 02 South Cross fuel anomaly)
  ('evt-hist-013',
   NOW() - INTERVAL '13 hours 15 min',
   'veh-del-02', 'DL05GH4002', 'drv-del-04', 'trip-h-013', NULL,
   'replay', 'rule_engine', 'FUEL_ANOMALY', 'MEDIUM',
   'Abnormal fuel consumption: 14 % drop over 18 km between ITO and Khan Market',
   '{"fuel_before_pct": 68, "fuel_after_pct": 54, "km": 18}'::jsonb),

  -- 5 hours ago — trip-h-014 (Mumbai Truck 02 North Corridor)
  ('evt-hist-014',
   NOW() - INTERVAL '5 hours 15 min',
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-014', NULL,
   'replay', 'rule_engine', 'OVERSPEED', 'HIGH',
   'Vehicle exceeded speed limit: 107 km/h in 70 km/h zone on WEH northbound',
   '{"limit_kph": 70, "recorded_kph": 107}'::jsonb),

  -- 3 hours ago — trip-h-015 (Mumbai Van 02 Port Loop)
  ('evt-hist-015',
   NOW() - INTERVAL '3 hours 10 min',
   'veh-mum-05', 'MH04CD2002', 'drv-mum-07', 'trip-h-015', NULL,
   'replay', 'rule_engine', 'OVERSPEED', 'MEDIUM',
   'Vehicle exceeded speed limit: 84 km/h in 60 km/h zone near Mulund bridge',
   '{"limit_kph": 60, "recorded_kph": 84}'::jsonb)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 5 — Alerts derived from the events above
-- Status distribution: 5 OPEN · 3 ACK · 7 CLOSED
-- Severity: LOW | MEDIUM | HIGH only
-- ============================================================================

INSERT INTO alerts (
  id, created_ts, updated_ts, closed_ts,
  vehicle_id, vehicle_reg_no, driver_id, trip_id, scenario_run_id,
  alert_type, severity, status,
  title, description, evidence, related_event_ids,
  acknowledged_by, acknowledged_ts, note, closure_reason
) VALUES

  -- ── OPEN (5) — most recent, unacknowledged ───────────────────────────────

  ('alert-hist-001',
   NOW() - INTERVAL '5 hours 15 min', NOW() - INTERVAL '5 hours 15 min', NULL,
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-014', NULL,
   'OVERSPEED', 'HIGH', 'OPEN',
   'Critical overspeed on WEH northbound',
   'MH04AB1002 recorded 107 km/h in a 70 km/h zone. Immediate driver coaching required.',
   '{"event_id": "evt-hist-014", "limit_kph": 70, "recorded_kph": 107}'::jsonb,
   ARRAY['evt-hist-014'],
   NULL, NULL, NULL, NULL),

  ('alert-hist-002',
   NOW() - INTERVAL '3 hours 10 min', NOW() - INTERVAL '3 hours 10 min', NULL,
   'veh-mum-05', 'MH04CD2002', 'drv-mum-07', 'trip-h-015', NULL,
   'OVERSPEED', 'MEDIUM', 'OPEN',
   'Overspeed near Mulund bridge',
   'MH04CD2002 exceeded 60 km/h limit at 84 km/h near Mulund bridge.',
   '{"event_id": "evt-hist-015", "limit_kph": 60, "recorded_kph": 84}'::jsonb,
   ARRAY['evt-hist-015'],
   NULL, NULL, NULL, NULL),

  ('alert-hist-003',
   NOW() - INTERVAL '13 hours 15 min', NOW() - INTERVAL '13 hours 15 min', NULL,
   'veh-del-02', 'DL05GH4002', 'drv-del-04', 'trip-h-013', NULL,
   'FUEL_ANOMALY', 'MEDIUM', 'OPEN',
   'Fuel anomaly — Delhi South Cross',
   '14 % fuel drop in 18 km between ITO and Khan Market. Possible sensor fault or siphoning.',
   '{"event_id": "evt-hist-013", "fuel_drop_pct": 14}'::jsonb,
   ARRAY['evt-hist-013'],
   NULL, NULL, NULL, NULL),

  ('alert-hist-004',
   NOW() - INTERVAL '22 hours 15 min', NOW() - INTERVAL '22 hours 15 min', NULL,
   'veh-mum-07', 'MH04EF3001', 'drv-mum-04', 'trip-h-012', NULL,
   'HARSH_BRAKE', 'HIGH', 'OPEN',
   'High-G braking near Vikhroli flyover',
   'Deceleration event at 0.88 g recorded. Vehicle inspected at depot, brake pads checked.',
   '{"event_id": "evt-hist-012", "decel_g": 0.88}'::jsonb,
   ARRAY['evt-hist-012'],
   NULL, NULL, NULL, NULL),

  ('alert-hist-005',
   NOW() - INTERVAL '2 days 0 hours 15 min', NOW() - INTERVAL '2 days 0 hours 15 min', NULL,
   'veh-mum-05', 'MH04CD2002', 'drv-mum-05', 'trip-h-010', NULL,
   'OVERSPEED', 'HIGH', 'OPEN',
   'Dangerous overspeed on Airoli freeway',
   'MH04CD2002 hit 102 km/h in a 60 km/h zone. Second overspeed incident this week.',
   '{"event_id": "evt-hist-011", "limit_kph": 60, "recorded_kph": 102}'::jsonb,
   ARRAY['evt-hist-011'],
   NULL, NULL, NULL, NULL),

  -- ── ACK (3) — acknowledged but still under review ────────────────────────

  ('alert-hist-006',
   NOW() - INTERVAL '1 day 2 hours 45 min', NOW() - INTERVAL '1 day 1 hour 30 min', NULL,
   'veh-mum-06', 'MH04CD2003', 'drv-mum-06', 'trip-mum-veh06-001', NULL,
   'GEOFENCE_BREACH', 'MEDIUM', 'ACK',
   'Geofence breach during cancelled trip',
   'Van left Mumbai Depot Zone without clearance at 19.0685, 72.8812. Trip cancelled shortly after.',
   '{"event_id": "evt-hist-010", "geofence_id": "gf-mum-01"}'::jsonb,
   ARRAY['evt-hist-010'],
   'drv-ops-dispatch', NOW() - INTERVAL '1 day 1 hour 30 min',
   'Driver reported mechanical issue. Trip cancelled. No further breach.', NULL),

  ('alert-hist-007',
   NOW() - INTERVAL '4 days 6 hours', NOW() - INTERVAL '4 days 4 hours 30 min', NULL,
   'veh-del-01', 'DL05GH4001', 'drv-del-01', 'trip-del-veh01-001', NULL,
   'HARSH_BRAKE', 'HIGH', 'ACK',
   'High-G braking on Ring Road',
   '0.91 g deceleration near Rajouri Garden. Detailed review requested with dash cam footage.',
   '{"event_id": "evt-hist-007", "decel_g": 0.91}'::jsonb,
   ARRAY['evt-hist-007'],
   'drv-ops-dispatch', NOW() - INTERVAL '4 days 4 hours 30 min',
   'Dash cam footage requested. Incident under safety review.', NULL),

  ('alert-hist-008',
   NOW() - INTERVAL '5 days 5 hours', NOW() - INTERVAL '5 days 3 hours', NULL,
   'veh-del-02', 'DL05GH4002', 'drv-del-02', 'trip-h-006', NULL,
   'FUEL_ANOMALY', 'HIGH', 'ACK',
   'Suspected fuel theft near Punjabi Bagh',
   '18 % fuel drop in 12 minutes with vehicle stationary. Depot security alerted.',
   '{"event_id": "evt-hist-005", "fuel_drop_pct": 18}'::jsonb,
   ARRAY['evt-hist-005'],
   'depot-manager-del', NOW() - INTERVAL '5 days 3 hours',
   'Fuel lock checked; depot security reviewed CCTV. Investigation ongoing.', NULL),

  -- ── CLOSED (7) — fully resolved ──────────────────────────────────────────

  ('alert-hist-009',
   NOW() - INTERVAL '7 days 5 hours 15 min', NOW() - INTERVAL '6 days 22 hours',
   NOW() - INTERVAL '6 days 22 hours',
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-001', NULL,
   'OVERSPEED', 'HIGH', 'CLOSED',
   'Overspeed on Eastern Express Hwy (resolved)',
   '96 km/h in 60 km/h zone. Driver coaching completed.',
   '{"event_id": "evt-hist-001", "limit_kph": 60, "recorded_kph": 96}'::jsonb,
   ARRAY['evt-hist-001'],
   'drv-ops-dispatch', NOW() - INTERVAL '7 days 3 hours',
   'Coaching session completed.', 'resolved_by_ops'),

  ('alert-hist-010',
   NOW() - INTERVAL '7 days 4 hours 45 min', NOW() - INTERVAL '7 days 2 hours',
   NOW() - INTERVAL '7 days 2 hours',
   'veh-mum-02', 'MH04AB1002', 'drv-mum-02', 'trip-h-001', NULL,
   'HARSH_BRAKE', 'MEDIUM', 'CLOSED',
   'Harsh braking at Ghatkopar (resolved)',
   '0.72 g braking event. Logged and closed after vehicle inspection.',
   '{"event_id": "evt-hist-002", "decel_g": 0.72}'::jsonb,
   ARRAY['evt-hist-002'],
   'depot-manager-mum', NOW() - INTERVAL '7 days 3 hours 30 min',
   'Vehicle brake system checked — no defect found.', 'resolved_by_ops'),

  ('alert-hist-011',
   NOW() - INTERVAL '7 days 7 hours 30 min', NOW() - INTERVAL '7 days 5 hours',
   NOW() - INTERVAL '7 days 5 hours',
   'veh-del-02', 'DL05GH4002', 'drv-del-02', 'trip-h-002', NULL,
   'DTC_FAULT', 'MEDIUM', 'CLOSED',
   'EGR fault code P0401 (resolved)',
   'Engine fault code cleared at next scheduled service. EGR valve cleaned.',
   '{"event_id": "evt-hist-003", "dtc_code": "P0401"}'::jsonb,
   ARRAY['evt-hist-003'],
   'depot-manager-del', NOW() - INTERVAL '6 days 12 hours',
   'EGR valve cleaned during service. Fault code cleared.', 'maintenance_action'),

  ('alert-hist-012',
   NOW() - INTERVAL '6 days 4 hours 10 min', NOW() - INTERVAL '5 days 20 hours',
   NOW() - INTERVAL '5 days 20 hours',
   'veh-mum-05', 'MH04CD2002', 'drv-mum-05', 'trip-h-003', NULL,
   'OVERSPEED', 'MEDIUM', 'CLOSED',
   'Overspeed on WEH near Andheri (resolved)',
   '88 km/h in 70 km/h zone. Minor violation, verbal warning issued.',
   '{"event_id": "evt-hist-004", "limit_kph": 70, "recorded_kph": 88}'::jsonb,
   ARRAY['evt-hist-004'],
   'drv-ops-dispatch', NOW() - INTERVAL '6 days 2 hours',
   'Verbal warning issued. Driver acknowledged.', 'resolved_by_ops'),

  ('alert-hist-013',
   NOW() - INTERVAL '5 days 3 hours', NOW() - INTERVAL '4 days 18 hours',
   NOW() - INTERVAL '4 days 18 hours',
   'veh-mum-07', 'MH04EF3001', 'drv-mum-07', 'trip-h-005', NULL,
   'FATIGUE', 'HIGH', 'CLOSED',
   'Driver fatigue — shift limit exceeded (resolved)',
   'Shift exceeded 8 h. Mandatory rest break enforced at depot.',
   '{"event_id": "evt-hist-006", "shift_hours": 8.4}'::jsonb,
   ARRAY['evt-hist-006'],
   'depot-manager-mum', NOW() - INTERVAL '5 days 1 hour',
   'Driver rested for 10 h before next assignment.', 'resolved_by_ops'),

  ('alert-hist-014',
   NOW() - INTERVAL '3 days 3 hours', NOW() - INTERVAL '2 days 20 hours',
   NOW() - INTERVAL '2 days 20 hours',
   'veh-del-02', 'DL05GH4002', 'drv-del-03', 'trip-h-009', NULL,
   'OVERSPEED', 'LOW', 'CLOSED',
   'Minor route deviation near Connaught Place (resolved)',
   '200 m deviation resolved. Driver rerouted via GPS. No further deviation.',
   '{"event_id": "evt-hist-008", "deviation_m": 200}'::jsonb,
   ARRAY['evt-hist-008'],
   'drv-ops-dispatch', NOW() - INTERVAL '3 days 1 hour',
   'GPS rerouting confirmed. No SLA impact.', 'resolved_by_driver'),

  ('alert-hist-015',
   NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '2 days 10 hours',
   NOW() - INTERVAL '2 days 10 hours',
   'veh-mum-01', 'MH04AB1001', 'drv-mum-01', 'trip-mum-veh01-001', NULL,
   'MAINTENANCE_DUE', 'MEDIUM', 'CLOSED',
   'Scheduled maintenance overdue — MH04AB1001 (resolved)',
   'Service completed at Mumbai Central Depot. Oil, filters, and brake pads replaced.',
   '{"event_id": "evt-hist-009", "km_overdue": 1200}'::jsonb,
   ARRAY['evt-hist-009'],
   'depot-manager-mum', NOW() - INTERVAL '3 days 1 hour',
   'Full service completed. Vehicle cleared for field operations.', 'maintenance_action')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 6 — Fuel anomaly events in fuel_events
-- (OpsEdge AI surfaces these via getFuelAnomaliesTool)
-- ============================================================================

INSERT INTO fuel_events (
  id, vehicle_id, trip_id, depot_id,
  event_type, fuel_delta_pct, estimated_liters,
  anomaly_score, status, evidence, ts
) VALUES

  ('fe-hist-001', 'veh-del-02', 'trip-h-006', 'depot-del-01',
   'anomaly', -18.0, 54.0, 0.94, 'OPEN',
   '{"note": "Sudden 18% drop while stationary near Punjabi Bagh"}'::jsonb,
   NOW() - INTERVAL '5 days 5 hours'),

  ('fe-hist-002', 'veh-del-02', 'trip-h-013', 'depot-del-01',
   'anomaly', -14.0, 16.8, 0.71, 'OPEN',
   '{"note": "Consumption 2.3x above baseline for vehicle type on this route"}'::jsonb,
   NOW() - INTERVAL '13 hours 15 min'),

  ('fe-hist-003', 'veh-mum-02', 'trip-h-001', 'depot-mum-01',
   'anomaly', -9.0, 27.0, 0.62, 'RESOLVED',
   '{"note": "Spike at Mulund turnaround, reviewed and cleared"}'::jsonb,
   NOW() - INTERVAL '7 days 5 hours')

ON CONFLICT (id) DO NOTHING;
