BEGIN;

SET search_path TO fleet, public;

CREATE TABLE IF NOT EXISTS alert_assignments (
  alert_id TEXT PRIMARY KEY REFERENCES alerts(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  owner_display_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACK', 'CLOSED')),
  sla_due_ts TIMESTAMPTZ NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  escalation_state TEXT NOT NULL CHECK (escalation_state IN ('ON_TRACK', 'AT_RISK', 'OVERDUE')),
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_assignments_owner_status_due
  ON alert_assignments(owner_user_id, status, sla_due_ts);

CREATE INDEX IF NOT EXISTS idx_alert_assignments_state_due
  ON alert_assignments(escalation_state, sla_due_ts);

DROP TRIGGER IF EXISTS trg_alert_assignments_updated_at ON alert_assignments;
CREATE TRIGGER trg_alert_assignments_updated_at
BEFORE UPDATE ON alert_assignments
FOR EACH ROW EXECUTE FUNCTION fleet.set_updated_at();

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS closure_reason TEXT;

ALTER TABLE alerts
  DROP CONSTRAINT IF EXISTS chk_alerts_closure_reason;

ALTER TABLE alerts
  ADD CONSTRAINT chk_alerts_closure_reason
  CHECK (
    closure_reason IS NULL
    OR closure_reason IN (
      'resolved_by_driver',
      'resolved_by_ops',
      'maintenance_action',
      'false_positive',
      'duplicate_alert',
      'other'
    )
  );

UPDATE alerts
SET closure_reason = 'other'
WHERE status = 'CLOSED'
  AND closure_reason IS NULL;

ALTER TABLE alerts
  DROP CONSTRAINT IF EXISTS chk_alerts_closed_reason_required;

ALTER TABLE alerts
  ADD CONSTRAINT chk_alerts_closed_reason_required
  CHECK (status <> 'CLOSED' OR closure_reason IS NOT NULL);

INSERT INTO alert_assignments (
  alert_id,
  owner_user_id,
  owner_display_name,
  status,
  sla_due_ts,
  escalation_level,
  escalation_state,
  assigned_by,
  assigned_at
)
SELECT
  a.id AS alert_id,
  CASE
    WHEN a.severity = 'HIGH' THEN 'safety-lead'
    WHEN a.alert_type IN ('FUEL_ANOMALY', 'DTC_FAULT', 'MAINTENANCE_DUE') THEN 'maintenance-desk'
    ELSE 'ops-desk'
  END AS owner_user_id,
  CASE
    WHEN a.severity = 'HIGH' THEN 'Safety Lead'
    WHEN a.alert_type IN ('FUEL_ANOMALY', 'DTC_FAULT', 'MAINTENANCE_DUE') THEN 'Maintenance Desk'
    ELSE 'Operations Desk'
  END AS owner_display_name,
  a.status,
  (
    a.created_ts
    + CASE
        WHEN a.severity = 'HIGH' THEN INTERVAL '30 minutes'
        WHEN a.severity = 'MEDIUM' THEN INTERVAL '60 minutes'
        ELSE INTERVAL '120 minutes'
      END
  ) AS sla_due_ts,
  CASE
    WHEN (
      a.created_ts
      + CASE
          WHEN a.severity = 'HIGH' THEN INTERVAL '30 minutes'
          WHEN a.severity = 'MEDIUM' THEN INTERVAL '60 minutes'
          ELSE INTERVAL '120 minutes'
        END
    ) < NOW() THEN 1
    ELSE 0
  END AS escalation_level,
  CASE
    WHEN (
      a.created_ts
      + CASE
          WHEN a.severity = 'HIGH' THEN INTERVAL '30 minutes'
          WHEN a.severity = 'MEDIUM' THEN INTERVAL '60 minutes'
          ELSE INTERVAL '120 minutes'
        END
    ) <= NOW() THEN 'OVERDUE'
    WHEN (
      a.created_ts
      + CASE
          WHEN a.severity = 'HIGH' THEN INTERVAL '30 minutes'
          WHEN a.severity = 'MEDIUM' THEN INTERVAL '60 minutes'
          ELSE INTERVAL '120 minutes'
        END
    ) <= (NOW() + INTERVAL '10 minutes') THEN 'AT_RISK'
    ELSE 'ON_TRACK'
  END AS escalation_state,
  'migration-0006' AS assigned_by,
  NOW() AS assigned_at
FROM alerts a
WHERE a.status IN ('OPEN', 'ACK')
ON CONFLICT (alert_id)
DO UPDATE SET
  owner_user_id = EXCLUDED.owner_user_id,
  owner_display_name = EXCLUDED.owner_display_name,
  status = EXCLUDED.status,
  sla_due_ts = EXCLUDED.sla_due_ts,
  escalation_level = EXCLUDED.escalation_level,
  escalation_state = EXCLUDED.escalation_state,
  assigned_by = EXCLUDED.assigned_by,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

COMMIT;
