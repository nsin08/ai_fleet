BEGIN;

SET search_path TO fleet, public;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(permissions_json) = 'array')
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_user
  ON user_roles(role_id, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ts
  ON audit_logs(ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_ts
  ON audit_logs(actor_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_ts
  ON audit_logs(entity_type, entity_id, ts DESC);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

INSERT INTO roles (id, name, permissions_json, description)
VALUES
  (
    'role_admin',
    'Administrator',
    '["*"]'::jsonb,
    'Full access to all operational and admin actions'
  ),
  (
    'role_dispatcher',
    'Dispatcher',
    '[
      "dispatch:trip:create",
      "dispatch:trip:assign",
      "dispatch:trip:transition",
      "dispatch:exception:write",
      "alerts:ack",
      "alerts:assign",
      "scenarios:control",
      "reports:read"
    ]'::jsonb,
    'Dispatch and trip-control operations'
  ),
  (
    'role_safety',
    'Safety Officer',
    '[
      "alerts:ack",
      "alerts:assign",
      "alerts:close",
      "alerts:bulk",
      "reports:read"
    ]'::jsonb,
    'Alert ownership and closure operations'
  ),
  (
    'role_maintenance',
    'Maintenance Lead',
    '[
      "maintenance:plan:write",
      "maintenance:work-order:create",
      "maintenance:work-order:transition",
      "fuel:anomaly:disposition",
      "reports:read"
    ]'::jsonb,
    'Maintenance and fuel-anomaly disposition operations'
  ),
  (
    'role_admin_reader',
    'Audit Reader',
    '[
      "admin:users:read",
      "admin:audit:read",
      "reports:read"
    ]'::jsonb,
    'Read-only access to admin and audit views'
  ),
  (
    'role_viewer',
    'Viewer',
    '[
      "reports:read"
    ]'::jsonb,
    'Read-only operational reporting access'
  )
ON CONFLICT (id)
DO UPDATE SET
  name = EXCLUDED.name,
  permissions_json = EXCLUDED.permissions_json,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO users (id, email, display_name, is_active)
VALUES
  ('ops-admin', 'ops-admin@fleetedge.local', 'Ops Admin', TRUE),
  ('ops-desk', 'ops-desk@fleetedge.local', 'Operations Desk', TRUE),
  ('safety-lead', 'safety-lead@fleetedge.local', 'Safety Lead', TRUE),
  ('maintenance-desk', 'maintenance-desk@fleetedge.local', 'Maintenance Desk', TRUE),
  ('dispatcher-01', 'dispatcher-01@fleetedge.local', 'Dispatcher 01', TRUE),
  ('viewer-01', 'viewer-01@fleetedge.local', 'Viewer 01', TRUE),
  ('compliance-01', 'compliance-01@fleetedge.local', 'Compliance 01', TRUE)
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO user_roles (user_id, role_id, assigned_by)
VALUES
  ('ops-admin', 'role_admin', 'migration-0007'),
  ('ops-desk', 'role_dispatcher', 'migration-0007'),
  ('ops-desk', 'role_safety', 'migration-0007'),
  ('safety-lead', 'role_safety', 'migration-0007'),
  ('maintenance-desk', 'role_maintenance', 'migration-0007'),
  ('dispatcher-01', 'role_dispatcher', 'migration-0007'),
  ('viewer-01', 'role_viewer', 'migration-0007'),
  ('compliance-01', 'role_admin_reader', 'migration-0007')
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
