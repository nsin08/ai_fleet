import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';
import { getActorId, requirePermission } from '../middleware/rbac.js';
import { writeAuditLog } from '../services/audit-log.service.js';

export const alertsRouter = Router();

const alertStatusSchema = z.enum(['OPEN', 'ACK', 'CLOSED']);
const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const escalationStateSchema = z.enum(['ON_TRACK', 'AT_RISK', 'OVERDUE']);
const closureReasonSchema = z.enum([
  'resolved_by_driver',
  'resolved_by_ops',
  'maintenance_action',
  'false_positive',
  'duplicate_alert',
  'other',
]);

const listQuerySchema = z.object({
  vehicleId: z.string().optional(),
  status: z.enum(['OPEN', 'ACK', 'CLOSED', 'open', 'ack', 'closed']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'low', 'medium', 'high', 'critical']).optional(),
  ownerUserId: z.string().optional(),
  escalationState: z.enum(['ON_TRACK', 'AT_RISK', 'OVERDUE', 'on_track', 'at_risk', 'overdue']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const assignBodySchema = z.object({
  ownerUserId: z.string().min(1),
  ownerDisplayName: z.string().max(120).optional(),
  assignedBy: z.string().max(120).optional(),
  slaDueTs: z.string().datetime().optional(),
  slaMinutes: z.coerce.number().int().positive().max(24 * 60).optional(),
});

const ackBodySchema = z.object({
  actorId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});

const closeBodySchema = z.object({
  closureReason: closureReasonSchema,
  resolution: z.string().max(500).optional(),
  actorId: z.string().max(120).optional(),
});

const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    alertIds: z.array(z.string().min(1)).min(1).max(200),
    ownerUserId: z.string().min(1),
    ownerDisplayName: z.string().max(120).optional(),
    assignedBy: z.string().max(120).optional(),
    slaDueTs: z.string().datetime().optional(),
    slaMinutes: z.coerce.number().int().positive().max(24 * 60).optional(),
  }),
  z.object({
    action: z.literal('ack'),
    alertIds: z.array(z.string().min(1)).min(1).max(200),
    actorId: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('close'),
    alertIds: z.array(z.string().min(1)).min(1).max(200),
    closureReason: closureReasonSchema,
    resolution: z.string().max(500).optional(),
    actorId: z.string().max(120).optional(),
  }),
]);

interface AlertCore {
  id: string;
  status: z.infer<typeof alertStatusSchema>;
  severity: z.infer<typeof severitySchema>;
  createdTs: string;
}

interface AlertAssignment {
  alertId: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  status: z.infer<typeof alertStatusSchema>;
  slaDueTs: string;
  escalationLevel: number;
  escalationState: z.infer<typeof escalationStateSchema>;
  assignedBy: string | null;
  assignedAt: string;
}

interface EscalationComputed {
  escalationState: z.infer<typeof escalationStateSchema>;
  escalationLevel: number;
}

const ALERT_FIELDS_SQL = `
  a.id,
  a.created_ts AS "createdTs",
  a.updated_ts AS "updatedTs",
  a.closed_ts AS "closedTs",
  a.vehicle_id AS "vehicleId",
  a.vehicle_reg_no AS "vehicleRegNo",
  a.driver_id AS "driverId",
  a.trip_id AS "tripId",
  a.scenario_run_id AS "scenarioRunId",
  a.alert_type AS "alertType",
  a.severity,
  a.status,
  a.title,
  a.description,
  a.evidence,
  a.related_event_ids AS "relatedEventIds",
  a.acknowledged_by AS "acknowledgedBy",
  a.acknowledged_ts AS "acknowledgedTs",
  a.note,
  a.closure_reason AS "closureReason",
  a.created_at AS "createdAt",
  a.updated_at AS "updatedAt",
  aa.owner_user_id AS "ownerUserId",
  aa.owner_display_name AS "ownerDisplayName",
  aa.sla_due_ts AS "slaDueTs",
  aa.escalation_level AS "escalationLevel",
  aa.assigned_by AS "assignedBy",
  aa.assigned_at AS "assignedAt",
  CASE
    WHEN aa.alert_id IS NULL THEN NULL
    WHEN aa.sla_due_ts <= NOW() THEN 'OVERDUE'
    WHEN aa.sla_due_ts <= NOW() + INTERVAL '10 minutes' THEN 'AT_RISK'
    ELSE 'ON_TRACK'
  END AS "escalationState"
`;

/** GET /api/alerts */
alertsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`a.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.status) {
      where.push(`a.status = $${idx++}`);
      params.push(query.status.toUpperCase());
    }
    if (query.severity) {
      where.push(`a.severity = $${idx++}`);
      params.push(query.severity.toUpperCase());
    }
    if (query.ownerUserId) {
      where.push(`aa.owner_user_id = $${idx++}`);
      params.push(query.ownerUserId);
    }
    if (query.escalationState) {
      where.push(`(
        CASE
          WHEN aa.alert_id IS NULL THEN NULL
          WHEN aa.sla_due_ts <= NOW() THEN 'OVERDUE'
          WHEN aa.sla_due_ts <= NOW() + INTERVAL '10 minutes' THEN 'AT_RISK'
          ELSE 'ON_TRACK'
        END
      ) = $${idx++}`);
      params.push(query.escalationState.toUpperCase());
    }
    if (query.from) {
      where.push(`a.created_ts >= $${idx++}`);
      params.push(new Date(query.from));
    }
    if (query.to) {
      where.push(`a.created_ts <= $${idx++}`);
      params.push(new Date(query.to));
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        ${ALERT_FIELDS_SQL}
      FROM fleet.alerts a
      LEFT JOIN fleet.alert_assignments aa ON aa.alert_id = a.id
      ${whereSql}
      ORDER BY
        CASE a.status
          WHEN 'OPEN' THEN 1
          WHEN 'ACK' THEN 2
          ELSE 3
        END,
        CASE
          WHEN aa.alert_id IS NULL THEN 4
          WHEN aa.sla_due_ts <= NOW() THEN 1
          WHEN aa.sla_due_ts <= NOW() + INTERVAL '10 minutes' THEN 2
          ELSE 3
        END,
        a.created_ts DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM fleet.alerts a
      LEFT JOIN fleet.alert_assignments aa ON aa.alert_id = a.id
      ${whereSql}
    `;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/alerts/:alertId */
alertsRouter.get('/:alertId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = await readAlertById(req.params['alertId']!);
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    return res.json(alert);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/:alertId/assign */
alertsRouter.post('/:alertId/assign', requirePermission('alerts:assign'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alertId = req.params['alertId']!;
    const body = assignBodySchema.parse(req.body);
    const alert = await readAlertCore(alertId);
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    if (alert.status === 'CLOSED') return res.status(409).json({ error: 'cannot assign closed alert' });

    const slaDueTs = body.slaDueTs
      ? new Date(body.slaDueTs)
      : body.slaMinutes
        ? new Date(Date.now() + body.slaMinutes * 60 * 1000)
        : defaultSlaDueTs(alert.severity, new Date(alert.createdTs));

    await upsertAssignment({
      alert,
      ownerUserId: body.ownerUserId,
      ownerDisplayName: body.ownerDisplayName ?? null,
      assignedBy: body.assignedBy ?? 'alerts-console',
      slaDueTs,
      status: alert.status,
    });

    const detail = await readAlertById(alertId);
    void writeAuditLog({
      actorId: getActorId(req, body.assignedBy ?? 'alerts-console'),
      action: 'alert.assign',
      entityType: 'alert',
      entityId: alertId,
      payload: {
        ownerUserId: body.ownerUserId,
        ownerDisplayName: body.ownerDisplayName ?? null,
        slaDueTs,
      },
    });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/:alertId/ack */
alertsRouter.post('/:alertId/ack', requirePermission('alerts:ack'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alertId = req.params['alertId']!;
    const body = ackBodySchema.parse(req.body);

    const alert = await readAlertCore(alertId);
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    if (alert.status === 'CLOSED') return res.status(409).json({ error: 'cannot acknowledge closed alert' });

    await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'ACK',
           acknowledged_by = COALESCE($2, acknowledged_by),
           acknowledged_ts = COALESCE(acknowledged_ts, NOW()),
           note = COALESCE($3, note),
           updated_at = NOW(),
           updated_ts = NOW()
       WHERE id = $1`,
      [alertId, body.actorId ?? null, body.note ?? null],
    );

    const assignment = await readAlertAssignment(alertId);
    const fallbackSlaDueTs = defaultSlaDueTs(alert.severity, new Date(alert.createdTs));
    await upsertAssignment({
      alert: { ...alert, status: 'ACK' },
      ownerUserId: assignment?.ownerUserId ?? body.actorId ?? 'ops-desk',
      ownerDisplayName: assignment?.ownerDisplayName ?? null,
      assignedBy: assignment?.assignedBy ?? body.actorId ?? 'alerts-console',
      slaDueTs: assignment ? new Date(assignment.slaDueTs) : fallbackSlaDueTs,
      status: 'ACK',
    });

    const detail = await readAlertById(alertId);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'alerts-console'),
      action: 'alert.ack',
      entityType: 'alert',
      entityId: alertId,
      payload: {
        note: body.note ?? null,
      },
    });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/:alertId/close */
alertsRouter.post('/:alertId/close', requirePermission('alerts:close'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alertId = req.params['alertId']!;
    const body = closeBodySchema.parse(req.body);

    const alert = await readAlertCore(alertId);
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    if (alert.status === 'CLOSED') return res.status(409).json({ error: 'alert already closed' });

    await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'CLOSED',
           closed_ts = NOW(),
           closure_reason = $2,
           note = COALESCE($3, note),
           updated_at = NOW(),
           updated_ts = NOW()
       WHERE id = $1`,
      [alertId, body.closureReason, body.resolution ?? null],
    );

    await getPool().query(
      `UPDATE fleet.alert_assignments
       SET status = 'CLOSED',
           escalation_state = 'ON_TRACK',
           escalation_level = 0,
           updated_at = NOW()
       WHERE alert_id = $1`,
      [alertId],
    );

    const detail = await readAlertById(alertId);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'alerts-console'),
      action: 'alert.close',
      entityType: 'alert',
      entityId: alertId,
      payload: {
        closureReason: body.closureReason,
        resolution: body.resolution ?? null,
      },
    });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/bulk */
alertsRouter.post('/bulk', requirePermission('alerts:bulk'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = bulkActionSchema.parse(req.body);

    if (body.action === 'assign') {
      const alerts = await readAlertsCoreByIds(body.alertIds);
      let updatedCount = 0;

      for (const alert of alerts) {
        if (alert.status === 'CLOSED') continue;
        const slaDueTs = body.slaDueTs
          ? new Date(body.slaDueTs)
          : body.slaMinutes
            ? new Date(Date.now() + body.slaMinutes * 60 * 1000)
            : defaultSlaDueTs(alert.severity, new Date(alert.createdTs));

        await upsertAssignment({
          alert,
          ownerUserId: body.ownerUserId,
          ownerDisplayName: body.ownerDisplayName ?? null,
          assignedBy: body.assignedBy ?? 'alerts-console',
          slaDueTs,
          status: alert.status,
        });
        updatedCount += 1;
      }

      const data = await readAlertsByIds(body.alertIds);
      void writeAuditLog({
        actorId: getActorId(req, body.assignedBy ?? 'alerts-console'),
        action: 'alert.bulk.assign',
        entityType: 'alert',
        entityId: null,
        payload: {
          alertIds: body.alertIds,
          updatedCount,
          ownerUserId: body.ownerUserId,
          ownerDisplayName: body.ownerDisplayName ?? null,
        },
      });
      return res.json({ updatedCount, data });
    }

    if (body.action === 'ack') {
      const result = await getPool().query(
        `UPDATE fleet.alerts
         SET status = 'ACK',
             acknowledged_by = COALESCE($2, acknowledged_by),
             acknowledged_ts = COALESCE(acknowledged_ts, NOW()),
             note = COALESCE($3, note),
             updated_at = NOW(),
             updated_ts = NOW()
         WHERE id = ANY($1::text[])
           AND status <> 'CLOSED'
         RETURNING id`,
        [body.alertIds, body.actorId ?? null, body.note ?? null],
      );

      const updatedIds = result.rows.map((row) => String(row['id']));
      const updatedAlerts = await readAlertsCoreByIds(updatedIds);
      for (const alert of updatedAlerts) {
        const assignment = await readAlertAssignment(alert.id);
        await upsertAssignment({
          alert: { ...alert, status: 'ACK' },
          ownerUserId: assignment?.ownerUserId ?? body.actorId ?? 'ops-desk',
          ownerDisplayName: assignment?.ownerDisplayName ?? null,
          assignedBy: assignment?.assignedBy ?? body.actorId ?? 'alerts-console',
          slaDueTs: assignment ? new Date(assignment.slaDueTs) : defaultSlaDueTs(alert.severity, new Date(alert.createdTs)),
          status: 'ACK',
        });
      }

      const data = await readAlertsByIds(body.alertIds);
      void writeAuditLog({
        actorId: getActorId(req, body.actorId ?? 'alerts-console'),
        action: 'alert.bulk.ack',
        entityType: 'alert',
        entityId: null,
        payload: {
          alertIds: body.alertIds,
          updatedCount: updatedIds.length,
        },
      });
      return res.json({ updatedCount: updatedIds.length, data });
    }

    const closeResult = await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'CLOSED',
           closed_ts = NOW(),
           closure_reason = $2,
           note = COALESCE($3, note),
           updated_at = NOW(),
           updated_ts = NOW()
       WHERE id = ANY($1::text[])
         AND status <> 'CLOSED'
       RETURNING id`,
      [body.alertIds, body.closureReason, body.resolution ?? null],
    );

    const closedIds = closeResult.rows.map((row) => String(row['id']));
    if (closedIds.length > 0) {
      await getPool().query(
        `UPDATE fleet.alert_assignments
         SET status = 'CLOSED',
             escalation_state = 'ON_TRACK',
             escalation_level = 0,
             updated_at = NOW()
         WHERE alert_id = ANY($1::text[])`,
        [closedIds],
      );
    }

    const data = await readAlertsByIds(body.alertIds);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'alerts-console'),
      action: 'alert.bulk.close',
      entityType: 'alert',
      entityId: null,
      payload: {
        alertIds: body.alertIds,
        updatedCount: closedIds.length,
        closureReason: body.closureReason,
        resolution: body.resolution ?? null,
      },
    });
    return res.json({ updatedCount: closedIds.length, data });
  } catch (err) {
    next(err);
  }
});

function defaultSlaDueTs(severity: z.infer<typeof severitySchema>, createdTs: Date): Date {
  const minutes = severity === 'HIGH' || severity === 'CRITICAL'
    ? 30
    : severity === 'MEDIUM'
      ? 60
      : 120;
  return new Date(createdTs.getTime() + minutes * 60 * 1000);
}

function computeEscalation(slaDueTs: Date): EscalationComputed {
  const now = Date.now();
  const due = slaDueTs.getTime();
  if (due <= now) {
    const overdueMs = now - due;
    const level = Math.min(5, Math.max(1, Math.floor(overdueMs / (30 * 60 * 1000)) + 1));
    return { escalationState: 'OVERDUE', escalationLevel: level };
  }
  if (due <= now + 10 * 60 * 1000) {
    return { escalationState: 'AT_RISK', escalationLevel: 0 };
  }
  return { escalationState: 'ON_TRACK', escalationLevel: 0 };
}

async function readAlertCore(alertId: string): Promise<AlertCore | null> {
  const result = await getPool().query(
    `SELECT
       id,
       status,
       severity,
       created_ts AS "createdTs"
     FROM fleet.alerts
     WHERE id = $1`,
    [alertId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row['id']),
    status: alertStatusSchema.parse(String(row['status']).toUpperCase()),
    severity: severitySchema.parse(String(row['severity']).toUpperCase()),
    createdTs: String(row['createdTs']),
  };
}

async function readAlertsCoreByIds(alertIds: string[]): Promise<AlertCore[]> {
  if (alertIds.length === 0) return [];
  const result = await getPool().query(
    `SELECT
       id,
       status,
       severity,
       created_ts AS "createdTs"
     FROM fleet.alerts
     WHERE id = ANY($1::text[])`,
    [alertIds],
  );
  return result.rows.map((row) => ({
    id: String(row['id']),
    status: alertStatusSchema.parse(String(row['status']).toUpperCase()),
    severity: severitySchema.parse(String(row['severity']).toUpperCase()),
    createdTs: String(row['createdTs']),
  }));
}

async function readAlertAssignment(alertId: string): Promise<AlertAssignment | null> {
  const result = await getPool().query(
    `SELECT
       alert_id AS "alertId",
       owner_user_id AS "ownerUserId",
       owner_display_name AS "ownerDisplayName",
       status,
       sla_due_ts AS "slaDueTs",
       escalation_level AS "escalationLevel",
       escalation_state AS "escalationState",
       assigned_by AS "assignedBy",
       assigned_at AS "assignedAt"
     FROM fleet.alert_assignments
     WHERE alert_id = $1`,
    [alertId],
  );
  return (result.rows[0] as AlertAssignment | undefined) ?? null;
}

async function upsertAssignment(input: {
  alert: AlertCore;
  ownerUserId: string;
  ownerDisplayName: string | null;
  assignedBy: string;
  slaDueTs: Date;
  status: z.infer<typeof alertStatusSchema>;
}): Promise<void> {
  const escalation = computeEscalation(input.slaDueTs);
  await getPool().query(
    `INSERT INTO fleet.alert_assignments
       (alert_id, owner_user_id, owner_display_name, status, sla_due_ts, escalation_level, escalation_state, assigned_by, assigned_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
       updated_at = NOW()`,
    [
      input.alert.id,
      input.ownerUserId,
      input.ownerDisplayName,
      input.status,
      input.slaDueTs,
      escalation.escalationLevel,
      escalation.escalationState,
      input.assignedBy,
    ],
  );
}

async function readAlertById(alertId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       ${ALERT_FIELDS_SQL}
     FROM fleet.alerts a
     LEFT JOIN fleet.alert_assignments aa ON aa.alert_id = a.id
     WHERE a.id = $1`,
    [alertId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function readAlertsByIds(alertIds: string[]): Promise<Record<string, unknown>[]> {
  if (alertIds.length === 0) return [];
  const result = await getPool().query(
    `SELECT
       ${ALERT_FIELDS_SQL}
     FROM fleet.alerts a
     LEFT JOIN fleet.alert_assignments aa ON aa.alert_id = a.id
     WHERE a.id = ANY($1::text[])
     ORDER BY a.created_ts DESC`,
    [alertIds],
  );
  return result.rows as Record<string, unknown>[];
}
