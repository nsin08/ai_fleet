import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';
import { getActorId, requirePermission } from '../middleware/rbac.js';
import { writeAuditLog } from '../services/audit-log.service.js';

export const maintenanceRouter = Router();

const workOrderStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const workOrderPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const listPlansQuerySchema = z.object({
  vehicleId: z.string().optional(),
  dueOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createPlanBodySchema = z.object({
  vehicleId: z.string().min(1),
  intervalKm: z.number().positive(),
  intervalDays: z.number().int().positive(),
  lastServiceAt: z.string().datetime().optional(),
  lastServiceOdometerKm: z.number().min(0).optional(),
  nextDueDate: z.string().date().optional(),
  nextDueOdometerKm: z.number().min(0).optional(),
  notes: z.string().max(400).optional(),
});

const listWorkOrdersQuerySchema = z.object({
  vehicleId: z.string().optional(),
  status: workOrderStatusSchema.optional(),
  priority: workOrderPrioritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createWorkOrderBodySchema = z.object({
  vehicleId: z.string().min(1),
  maintenancePlanId: z.string().uuid().optional(),
  priority: workOrderPrioritySchema.default('MEDIUM'),
  title: z.string().min(3).max(140),
  description: z.string().max(500).optional(),
  openedBy: z.string().max(120).optional(),
  assignedTo: z.string().max(120).optional(),
});

const transitionWorkOrderBodySchema = z.object({
  status: workOrderStatusSchema,
  resolutionNote: z.string().max(500).optional(),
  assignedTo: z.string().max(120).optional(),
});

const ALLOWED_WORK_ORDER_TRANSITIONS: Record<
  z.infer<typeof workOrderStatusSchema>,
  z.infer<typeof workOrderStatusSchema>[]
> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

interface WorkOrderLookup {
  id: string;
  vehicleId: string;
  status: z.infer<typeof workOrderStatusSchema>;
}

/** GET /api/maintenance/plans */
maintenanceRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listPlansQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`mp.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.dueOnly) {
      where.push(`(
        mp.next_due_date <= CURRENT_DATE
        OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 0
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dataSql = `
      SELECT
        mp.id,
        mp.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        v.vehicle_type AS "vehicleType",
        mp.interval_km AS "intervalKm",
        mp.interval_days AS "intervalDays",
        mp.last_service_at AS "lastServiceAt",
        mp.last_service_odometer_km AS "lastServiceOdometerKm",
        mp.next_due_date AS "nextDueDate",
        mp.next_due_odometer_km AS "nextDueOdometerKm",
        mp.notes,
        mp.created_at AS "createdAt",
        mp.updated_at AS "updatedAt",
        COALESCE(vls.odometer_km, v.initial_odometer_km) AS "currentOdometerKm",
        (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) AS "kmRemaining",
        (mp.next_due_date - CURRENT_DATE)::int AS "daysRemaining",
        CASE
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 0
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 0
            THEN 'CRITICAL'
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 3
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 500
            THEN 'HIGH'
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 7
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 1500
            THEN 'MEDIUM'
          ELSE 'LOW'
        END AS urgency
      FROM fleet.maintenance_plans mp
      INNER JOIN fleet.vehicles v ON v.id = mp.vehicle_id
      LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = mp.vehicle_id
      ${whereSql}
      ORDER BY
        CASE
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 0
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 0
            THEN 1
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 3
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 500
            THEN 2
          WHEN (mp.next_due_date - CURRENT_DATE)::int <= 7
            OR (mp.next_due_odometer_km - COALESCE(vls.odometer_km, v.initial_odometer_km)) <= 1500
            THEN 3
          ELSE 4
        END ASC,
        mp.next_due_date ASC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM fleet.maintenance_plans mp ${whereSql}`;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** POST /api/maintenance/plans */
maintenanceRouter.post('/plans', requirePermission('maintenance:plan:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createPlanBodySchema.parse(req.body);
    const lastServiceAt = body.lastServiceAt ? new Date(body.lastServiceAt) : new Date();
    const lastServiceOdometerKm = body.lastServiceOdometerKm ?? await readVehicleCurrentOdometer(body.vehicleId);
    const nextDueDate = body.nextDueDate
      ? body.nextDueDate
      : new Date(lastServiceAt.getTime() + body.intervalDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextDueOdometerKm = body.nextDueOdometerKm ?? lastServiceOdometerKm + body.intervalKm;

    await getPool().query(
      `INSERT INTO fleet.maintenance_plans
         (vehicle_id, interval_km, interval_days, last_service_at, last_service_odometer_km, next_due_date, next_due_odometer_km, notes)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (vehicle_id)
       DO UPDATE SET
         interval_km = EXCLUDED.interval_km,
         interval_days = EXCLUDED.interval_days,
         last_service_at = EXCLUDED.last_service_at,
         last_service_odometer_km = EXCLUDED.last_service_odometer_km,
         next_due_date = EXCLUDED.next_due_date,
         next_due_odometer_km = EXCLUDED.next_due_odometer_km,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [
        body.vehicleId,
        body.intervalKm,
        body.intervalDays,
        lastServiceAt,
        lastServiceOdometerKm,
        nextDueDate,
        nextDueOdometerKm,
        body.notes ?? null,
      ],
    );

    const result = await getPool().query(
      `SELECT id
       FROM fleet.maintenance_plans
       WHERE vehicle_id = $1`,
      [body.vehicleId],
    );
    const planId = result.rows[0]?.['id'];
    const detail = await readMaintenancePlanById(String(planId));
    void writeAuditLog({
      actorId: getActorId(req),
      action: 'maintenance.plan.upsert',
      entityType: 'maintenance_plan',
      entityId: planId ? String(planId) : null,
      payload: {
        vehicleId: body.vehicleId,
        intervalKm: body.intervalKm,
        intervalDays: body.intervalDays,
        nextDueDate,
        nextDueOdometerKm,
      },
    });
    return res.status(201).json(detail);
  } catch (err) {
    next(err);
  }
});

/** GET /api/maintenance/work-orders */
maintenanceRouter.get('/work-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listWorkOrdersQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`wo.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.status) {
      where.push(`wo.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.priority) {
      where.push(`wo.priority = $${idx++}`);
      params.push(query.priority);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dataSql = `
      SELECT
        wo.id,
        wo.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        wo.maintenance_plan_id AS "maintenancePlanId",
        wo.priority,
        wo.status,
        wo.title,
        wo.description,
        wo.opened_at AS "openedAt",
        wo.started_at AS "startedAt",
        wo.resolved_at AS "resolvedAt",
        wo.closed_at AS "closedAt",
        wo.opened_by AS "openedBy",
        wo.assigned_to AS "assignedTo",
        wo.resolution_note AS "resolutionNote",
        wo.created_at AS "createdAt",
        wo.updated_at AS "updatedAt"
      FROM fleet.work_orders wo
      LEFT JOIN fleet.vehicles v ON v.id = wo.vehicle_id
      ${whereSql}
      ORDER BY wo.opened_at DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM fleet.work_orders wo ${whereSql}`;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/maintenance/work-orders/:workOrderId */
maintenanceRouter.get('/work-orders/:workOrderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await readWorkOrderById(req.params['workOrderId']!);
    if (!detail) return res.status(404).json({ error: 'work order not found' });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/maintenance/work-orders */
maintenanceRouter.post('/work-orders', requirePermission('maintenance:work-order:create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createWorkOrderBodySchema.parse(req.body);
    const workOrderId = `wo-${randomUUID()}`;
    await getPool().query(
      `INSERT INTO fleet.work_orders
         (id, vehicle_id, maintenance_plan_id, priority, status, title, description, opened_by, assigned_to)
       VALUES
         ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8)`,
      [
        workOrderId,
        body.vehicleId,
        body.maintenancePlanId ?? null,
        body.priority,
        body.title,
        body.description ?? null,
        body.openedBy ?? 'maintenance-console',
        body.assignedTo ?? null,
      ],
    );

    await syncVehicleMaintenanceState(body.vehicleId);
    const detail = await readWorkOrderById(workOrderId);
    void writeAuditLog({
      actorId: getActorId(req, body.openedBy ?? 'maintenance-console'),
      action: 'work_order.create',
      entityType: 'work_order',
      entityId: workOrderId,
      payload: {
        vehicleId: body.vehicleId,
        maintenancePlanId: body.maintenancePlanId ?? null,
        priority: body.priority,
        assignedTo: body.assignedTo ?? null,
      },
    });
    return res.status(201).json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/maintenance/work-orders/:workOrderId/transition */
maintenanceRouter.post('/work-orders/:workOrderId/transition', requirePermission('maintenance:work-order:transition'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = req.params['workOrderId']!;
    const body = transitionWorkOrderBodySchema.parse(req.body);
    const workOrder = await readWorkOrderLookup(workOrderId);
    if (!workOrder) return res.status(404).json({ error: 'work order not found' });

    if (workOrder.status === body.status) {
      const same = await readWorkOrderById(workOrderId);
      return res.json(same);
    }

    if (!ALLOWED_WORK_ORDER_TRANSITIONS[workOrder.status].includes(body.status)) {
      return res.status(409).json({ error: `invalid work order transition from ${workOrder.status} to ${body.status}` });
    }

    await getPool().query(
      `UPDATE fleet.work_orders
       SET status = $1,
           started_at = CASE WHEN $1 = 'IN_PROGRESS' THEN COALESCE(started_at, NOW()) ELSE started_at END,
           resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END,
           closed_at = CASE WHEN $1 = 'CLOSED' THEN NOW() ELSE closed_at END,
           resolution_note = COALESCE($2, resolution_note),
           assigned_to = COALESCE($3, assigned_to),
           updated_at = NOW()
       WHERE id = $4`,
      [body.status, body.resolutionNote ?? null, body.assignedTo ?? null, workOrderId],
    );

    await syncVehicleMaintenanceState(workOrder.vehicleId);
    const updated = await readWorkOrderById(workOrderId);
    void writeAuditLog({
      actorId: getActorId(req),
      action: 'work_order.transition',
      entityType: 'work_order',
      entityId: workOrderId,
      payload: {
        vehicleId: workOrder.vehicleId,
        fromStatus: workOrder.status,
        toStatus: body.status,
        assignedTo: body.assignedTo ?? null,
        resolutionNote: body.resolutionNote ?? null,
      },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function readVehicleCurrentOdometer(vehicleId: string): Promise<number> {
  const result = await getPool().query(
    `SELECT COALESCE(vls.odometer_km, v.initial_odometer_km) AS "odometerKm"
     FROM fleet.vehicles v
     LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = v.id
     WHERE v.id = $1`,
    [vehicleId],
  );
  return Number(result.rows[0]?.['odometerKm'] ?? 0);
}

async function readMaintenancePlanById(planId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       mp.id,
       mp.vehicle_id AS "vehicleId",
       v.vehicle_reg_no AS "vehicleRegNo",
       v.vehicle_type AS "vehicleType",
       mp.interval_km AS "intervalKm",
       mp.interval_days AS "intervalDays",
       mp.last_service_at AS "lastServiceAt",
       mp.last_service_odometer_km AS "lastServiceOdometerKm",
       mp.next_due_date AS "nextDueDate",
       mp.next_due_odometer_km AS "nextDueOdometerKm",
       mp.notes,
       mp.created_at AS "createdAt",
       mp.updated_at AS "updatedAt"
     FROM fleet.maintenance_plans mp
     INNER JOIN fleet.vehicles v ON v.id = mp.vehicle_id
     WHERE mp.id = $1`,
    [planId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function readWorkOrderLookup(workOrderId: string): Promise<WorkOrderLookup | null> {
  const result = await getPool().query(
    `SELECT
       id,
       vehicle_id AS "vehicleId",
       status
     FROM fleet.work_orders
     WHERE id = $1`,
    [workOrderId],
  );
  return (result.rows[0] as WorkOrderLookup | undefined) ?? null;
}

async function readWorkOrderById(workOrderId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       wo.id,
       wo.vehicle_id AS "vehicleId",
       v.vehicle_reg_no AS "vehicleRegNo",
       wo.maintenance_plan_id AS "maintenancePlanId",
       wo.priority,
       wo.status,
       wo.title,
       wo.description,
       wo.opened_at AS "openedAt",
       wo.started_at AS "startedAt",
       wo.resolved_at AS "resolvedAt",
       wo.closed_at AS "closedAt",
       wo.opened_by AS "openedBy",
       wo.assigned_to AS "assignedTo",
       wo.resolution_note AS "resolutionNote",
       wo.created_at AS "createdAt",
       wo.updated_at AS "updatedAt"
     FROM fleet.work_orders wo
     LEFT JOIN fleet.vehicles v ON v.id = wo.vehicle_id
     WHERE wo.id = $1`,
    [workOrderId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function syncVehicleMaintenanceState(vehicleId: string): Promise<void> {
  const openResult = await getPool().query(
    `SELECT COUNT(*)::int AS count
     FROM fleet.work_orders
     WHERE vehicle_id = $1
       AND status IN ('OPEN', 'IN_PROGRESS')`,
    [vehicleId],
  );
  const openCount = Number(openResult.rows[0]?.['count'] ?? 0);
  const hasOpenWorkOrder = openCount > 0;

  if (hasOpenWorkOrder) {
    await Promise.all([
      getPool().query(
        `UPDATE fleet.vehicles
         SET status = 'maintenance_due',
             updated_at = NOW()
         WHERE id = $1`,
        [vehicleId],
      ),
      getPool().query(
        `UPDATE fleet.vehicle_latest_state
         SET status = 'maintenance_due',
             maintenance_due = TRUE,
             updated_at = NOW()
         WHERE vehicle_id = $1`,
        [vehicleId],
      ),
    ]);
    return;
  }

  const activeTripResult = await getPool().query(
    `SELECT 1
     FROM fleet.trips
     WHERE vehicle_id = $1
       AND status IN ('planned', 'active', 'paused')
     LIMIT 1`,
    [vehicleId],
  );
  const fallbackStatus = activeTripResult.rows.length > 0 ? 'on_trip' : 'idle';

  await Promise.all([
    getPool().query(
      `UPDATE fleet.vehicles
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [vehicleId, fallbackStatus],
    ),
    getPool().query(
      `UPDATE fleet.vehicle_latest_state
       SET status = $2,
           maintenance_due = FALSE,
           updated_at = NOW()
       WHERE vehicle_id = $1`,
      [vehicleId, fallbackStatus],
    ),
  ]);
}
