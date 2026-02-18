-- ============================================================================
-- 002_demo_scenarios.sql — Demo scenario definitions + steps
-- Idempotent: uses ON CONFLICT DO NOTHING
-- ============================================================================

SET search_path TO fleet, public;

-- ── Scenario Definitions ────────────────────────────────────────────────────

INSERT INTO scenario_definitions (id, name, description, timeline_sec, is_active)
VALUES
  ('scenario-mumbai-morning',
   'Mumbai Morning Rush',
   'Simulates morning rush hour across Mumbai depot vehicles. Includes overspeed events on the expressway and fuel anomalies.',
   3600, TRUE),
  ('scenario-delhi-delivery',
   'Delhi Delivery Run',
   'Full-day delivery run for Delhi depot trucks and vans. Covers highway, urban, and warehouse stops.',
   7200, TRUE),
  ('scenario-mixed-alert',
   'Mixed Alert Demo',
   'Short 15-minute scenario designed to trigger multiple alert types quickly for demo purposes.',
   900, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Steps for Mumbai Morning Rush ──────────────────────────────────────────

INSERT INTO scenario_definition_steps (scenario_id, step_no, at_sec, action, data)
VALUES
  ('scenario-mumbai-morning', 1,   0,   'start_engines',  '{"vehicles": "all", "depot": "depot-mum-01"}'::jsonb),
  ('scenario-mumbai-morning', 2,  60,   'begin_route',    '{"route_id": "route-mum-01", "speed_profile": "urban"}'::jsonb),
  ('scenario-mumbai-morning', 3, 600,   'overspeed_burst', '{"target_speed_kph": 110, "duration_sec": 30}'::jsonb),
  ('scenario-mumbai-morning', 4, 1200,  'refuel_stop',    '{"vehicle": "veh-mum-03", "fuel_pct_target": 90}'::jsonb),
  ('scenario-mumbai-morning', 5, 1800,  'traffic_jam',    '{"duration_sec": 300, "affected_vehicles": "all"}'::jsonb),
  ('scenario-mumbai-morning', 6, 3000,  'arrive_depot',   '{"depot": "depot-mum-01"}'::jsonb),
  ('scenario-mumbai-morning', 7, 3600,  'end_scenario',   '{}'::jsonb)
ON CONFLICT (scenario_id, step_no) DO NOTHING;

-- ── Steps for Delhi Delivery Run ──────────────────────────────────────────

INSERT INTO scenario_definition_steps (scenario_id, step_no, at_sec, action, data)
VALUES
  ('scenario-delhi-delivery', 1,    0,   'start_engines',    '{"vehicles": "all", "depot": "depot-del-01"}'::jsonb),
  ('scenario-delhi-delivery', 2,  120,   'begin_route',      '{"route_id": "route-del-01", "speed_profile": "highway"}'::jsonb),
  ('scenario-delhi-delivery', 3,  900,   'delivery_stop',    '{"stop": 1, "duration_sec": 180}'::jsonb),
  ('scenario-delhi-delivery', 4, 1800,   'fuel_anomaly',     '{"vehicle": "veh-del-02", "fuel_pct_drop": 5}'::jsonb),
  ('scenario-delhi-delivery', 5, 3600,   'delivery_stop',    '{"stop": 2, "duration_sec": 240}'::jsonb),
  ('scenario-delhi-delivery', 6, 5400,   'harsh_brake_event','{"vehicle": "veh-del-01"}'::jsonb),
  ('scenario-delhi-delivery', 7, 7200,   'end_scenario',     '{}'::jsonb)
ON CONFLICT (scenario_id, step_no) DO NOTHING;

-- ── Steps for Mixed Alert Demo ──────────────────────────────────────────

INSERT INTO scenario_definition_steps (scenario_id, step_no, at_sec, action, data)
VALUES
  ('scenario-mixed-alert', 1,   0,  'start_engines',    '{"vehicles": "all"}'::jsonb),
  ('scenario-mixed-alert', 2,  60,  'overspeed_burst',  '{"target_speed_kph": 120, "duration_sec": 20}'::jsonb),
  ('scenario-mixed-alert', 3, 180,  'fuel_anomaly',     '{"vehicle": "veh-mum-01", "fuel_pct_drop": 85}'::jsonb),
  ('scenario-mixed-alert', 4, 300,  'harsh_brake_event','{"vehicle": "veh-del-01"}'::jsonb),
  ('scenario-mixed-alert', 5, 600,  'geofence_breach',  '{"vehicle": "veh-mum-04"}'::jsonb),
  ('scenario-mixed-alert', 6, 900,  'end_scenario',     '{}'::jsonb)
ON CONFLICT (scenario_id, step_no) DO NOTHING;
