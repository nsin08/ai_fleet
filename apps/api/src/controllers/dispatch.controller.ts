import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';
import { getActorId, requirePermission } from '../middleware/rbac.js';
import { writeAuditLog } from '../services/audit-log.service.js';

export const dispatchRouter = Router();

const tripStatusSchema = z.enum(['planned', 'active', 'paused', 'completed', 'cancelled']);
const exceptionTypeSchema = z.enum(['sla_delay', 'off_route', 'idle_overrun', 'fuel_anomaly', 'manual_blocker']);
const exceptionSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const exceptionStatusSchema = z.enum(['OPEN', 'ACK', 'RESOLVED']);
const driverAvailabilitySchema = z.enum(['available', 'on_trip', 'off_shift', 'leave']);

const listTripsQuerySchema = z.object({
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  status: tripStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const createTripBodySchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().min(1),
  routeId: z.string().optional(),
  startDepotId: z.string().optional(),
  endDepotId: z.string().optional(),
  plannedDistanceKm: z.number().positive().optional(),
  plannedEtaAt: z.string().datetime().optional(),
  delayReason: z.string().min(1).max(200).optional(),
  startedAt: z.string().datetime().optional(),
  actorId: z.string().optional(),
  note: z.string().max(200).optional(),
});

const assignTripBodySchema = z
  .object({
    vehicleId: z.string().min(1).optional(),
    driverId: z.string().min(1).optional(),
    routeId: z.string().min(1).optional(),
    actorId: z.string().optional(),
    note: z.string().max(200).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.vehicleId || v.driverId || v.routeId), {
    message: 'at least one field is required',
  });

const transitionTripBodySchema = z.object({
  status: tripStatusSchema,
  endedAt: z.string().datetime().optional(),
  endReason: z.string().min(1).max(200).optional(),
  delayReason: z.string().min(1).max(200).optional(),
});

const createExceptionBodySchema = z.object({
  exceptionType: exceptionTypeSchema,
  severity: exceptionSeveritySchema.default('MEDIUM'),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  evidence: z.record(z.unknown()).optional(),
  raisedBy: z.string().optional(),
});

const updateExceptionStatusBodySchema = z.object({
  status: z.enum(['ACK', 'RESOLVED']),
  closedBy: z.string().optional(),
});

const ALLOWED_TRIP_TRANSITIONS: Record<
  z.infer<typeof tripStatusSchema>,
  z.infer<typeof tripStatusSchema>[]
> = {
  planned: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

const ALLOWED_EXCEPTION_TRANSITIONS: Record<
  z.infer<typeof exceptionStatusSchema>,
  z.infer<typeof exceptionStatusSchema>[]
> = {
  OPEN: ['ACK', 'RESOLVED'],
  ACK: ['RESOLVED'],
  RESOLVED: [],
};

interface TripLookup {
  id: string;
  status: z.infer<typeof tripStatusSchema>;
  vehicleId: string;
  driverId: string;
  routeId?: string;
}

interface TripExceptionLookup {
  id: string;
  status: z.infer<typeof exceptionStatusSchema>;
}

interface DriverAvailabilityLookup {
  id: string;
  isActive: boolean;
  availabilityStatus: z.infer<typeof driverAvailabilitySchema>;
}

/** GET /api/dispatch/trips */
dispatchRouter.get('/trips', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listTripsQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`t.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.driverId) {
      where.push(`t.driver_id = $${idx++}`);
      params.push(query.driverId);
    }
    if (query.status) {
      where.push(`t.status = $${idx++}`);
      params.push(query.status);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const dataSql = `
      SELECT
        t.id,
        t.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        t.driver_id AS "driverId",
        d.name AS "driverName",
        t.route_id AS "routeId",
        r.name AS "routeName",
        t.status,
        t.started_at AS "startedAt",
        t.ended_at AS "endedAt",
        t.planned_eta_at AS "plannedEtaAt",
        t.start_depot_id AS "startDepotId",
        sd.name AS "startDepotName",
        t.end_depot_id AS "endDepotId",
        ed.name AS "endDepotName",
        t.planned_distance_km AS "plannedDistanceKm",
        t.actual_distance_km AS "actualDistanceKm",
        t.delay_reason AS "delayReason",
        t.end_reason AS "endReason",
        (
          SELECT COUNT(*)::int
          FROM fleet.trip_stops ts
          WHERE ts.trip_id = t.id
        ) AS "stopCount",
        (
          SELECT COUNT(*)::int
          FROM fleet.trip_exceptions te
          WHERE te.trip_id = t.id
            AND te.status <> 'RESOLVED'
        ) AS "openExceptionCount",
        (
          SELECT MAX(ta.assigned_at)
          FROM fleet.trip_assignments ta
          WHERE ta.trip_id = t.id
        ) AS "lastAssignedAt"
      FROM fleet.trips t
      LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN fleet.drivers d ON d.id = t.driver_id
      LEFT JOIN fleet.routes r ON r.id = t.route_id
      LEFT JOIN fleet.depots sd ON sd.id = t.start_depot_id
      LEFT JOIN fleet.depots ed ON ed.id = t.end_depot_id
      ${whereSql}
      ORDER BY t.started_at DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM fleet.trips t ${whereSql}`;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/dispatch/trips/:tripId */
dispatchRouter.get('/trips/:tripId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await readTripDispatchDetail(req.params['tripId']!);
    if (!detail) return res.status(404).json({ error: 'trip not found' });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/dispatch/trips */
dispatchRouter.post('/trips', requirePermission('dispatch:trip:create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTripBodySchema.parse(req.body);
    const driver = await readDriverAvailability(body.driverId);
    if (!driver) return res.status(404).json({ error: 'driver not found' });
    if (!isDriverAssignable(driver)) {
      return res.status(409).json({ error: `driver ${body.driverId} unavailable (${driver.availabilityStatus})` });
    }

    const tripId = `trip-${randomUUID()}`;
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    const plannedEtaAt = body.plannedEtaAt
      ? new Date(body.plannedEtaAt)
      : await estimatePlannedEtaAt(body.routeId, startedAt);

    await getPool().query(
      `INSERT INTO fleet.trips
         (id, vehicle_id, driver_id, route_id, status, started_at, start_depot_id, end_depot_id, planned_distance_km, planned_eta_at, delay_reason)
       VALUES
         ($1, $2, $3, $4, 'planned', $5, $6, $7, $8, $9, $10)`,
      [
        tripId,
        body.vehicleId,
        body.driverId,
        body.routeId ?? null,
        startedAt,
        body.startDepotId ?? null,
        body.endDepotId ?? null,
        body.plannedDistanceKm ?? null,
        plannedEtaAt,
        body.delayReason ?? null,
      ],
    );

    await appendTripAssignment({
      tripId,
      previousVehicleId: null,
      previousDriverId: null,
      previousRouteId: null,
      newVehicleId: body.vehicleId,
      newDriverId: body.driverId,
      newRouteId: body.routeId ?? null,
      assignedBy: body.actorId ?? 'system',
      note: body.note ?? 'trip created',
      metadata: { source: 'create' },
    });

    const trip = await readTripDispatchDetail(tripId);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'system'),
      action: 'trip.create',
      entityType: 'trip',
      entityId: tripId,
      payload: {
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        routeId: body.routeId ?? null,
        status: 'planned',
      },
    });
    return res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

/** POST /api/dispatch/trips/:tripId/assign */
dispatchRouter.post('/trips/:tripId/assign', requirePermission('dispatch:trip:assign'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params['tripId']!;
    const body = assignTripBodySchema.parse(req.body);
    const trip = await readTripLookup(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    if (!['planned', 'paused'].includes(trip.status)) {
      return res.status(409).json({ error: `cannot assign trip in status ${trip.status}` });
    }

    if (body.driverId) {
      const driver = await readDriverAvailability(body.driverId, tripId);
      if (!driver) return res.status(404).json({ error: 'driver not found' });
      if (!isDriverAssignable(driver)) {
        return res.status(409).json({ error: `driver ${body.driverId} unavailable (${driver.availabilityStatus})` });
      }
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.vehicleId) {
      fields.push(`vehicle_id = $${idx++}`);
      params.push(body.vehicleId);
    }
    if (body.driverId) {
      fields.push(`driver_id = $${idx++}`);
      params.push(body.driverId);
    }
    if (body.routeId) {
      fields.push(`route_id = $${idx++}`);
      params.push(body.routeId);
    }

    params.push(tripId);
    await getPool().query(
      `UPDATE fleet.trips
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}`,
      params,
    );

    await appendTripAssignment({
      tripId,
      previousVehicleId: trip.vehicleId,
      previousDriverId: trip.driverId,
      previousRouteId: trip.routeId ?? null,
      newVehicleId: body.vehicleId ?? trip.vehicleId,
      newDriverId: body.driverId ?? trip.driverId,
      newRouteId: body.routeId ?? trip.routeId ?? null,
      assignedBy: body.actorId ?? 'dispatcher',
      note: body.note ?? null,
      metadata: body.metadata ?? {},
    });

    const updated = await readTripDispatchDetail(tripId);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'dispatcher'),
      action: 'trip.assign',
      entityType: 'trip',
      entityId: tripId,
      payload: {
        previousVehicleId: trip.vehicleId,
        previousDriverId: trip.driverId,
        previousRouteId: trip.routeId ?? null,
        newVehicleId: body.vehicleId ?? trip.vehicleId,
        newDriverId: body.driverId ?? trip.driverId,
        newRouteId: body.routeId ?? trip.routeId ?? null,
        note: body.note ?? null,
      },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /api/dispatch/trips/:tripId/transition */
dispatchRouter.post('/trips/:tripId/transition', requirePermission('dispatch:trip:transition'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params['tripId']!;
    const body = transitionTripBodySchema.parse(req.body);
    const trip = await readTripLookup(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    if (trip.status === body.status) {
      const same = await readTripDispatchDetail(tripId);
      return res.json(same);
    }

    if (!ALLOWED_TRIP_TRANSITIONS[trip.status].includes(body.status)) {
      return res.status(409).json({ error: `invalid transition from ${trip.status} to ${body.status}` });
    }

    const endedAt =
      body.endedAt
        ? new Date(body.endedAt)
        : body.status === 'completed' || body.status === 'cancelled'
          ? new Date()
          : null;

    await getPool().query(
      `UPDATE fleet.trips
       SET status = $1,
           ended_at = CASE WHEN $2::timestamptz IS NULL THEN ended_at ELSE $2 END,
           end_reason = COALESCE($3, end_reason),
           delay_reason = COALESCE($4, delay_reason),
           updated_at = NOW()
       WHERE id = $5`,
      [body.status, endedAt, body.endReason ?? null, body.delayReason ?? null, tripId],
    );

    const updated = await readTripDispatchDetail(tripId);
    void writeAuditLog({
      actorId: getActorId(req),
      action: 'trip.transition',
      entityType: 'trip',
      entityId: tripId,
      payload: {
        fromStatus: trip.status,
        toStatus: body.status,
        endedAt,
        endReason: body.endReason ?? null,
        delayReason: body.delayReason ?? null,
      },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /api/dispatch/trips/:tripId/exceptions */
dispatchRouter.post('/trips/:tripId/exceptions', requirePermission('dispatch:exception:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params['tripId']!;
    const trip = await readTripLookup(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    const body = createExceptionBodySchema.parse(req.body);
    const exceptionId = randomUUID();

    await getPool().query(
      `INSERT INTO fleet.trip_exceptions
         (id, trip_id, exception_type, severity, status, title, description, evidence, raised_by)
       VALUES
         ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8)`,
      [
        exceptionId,
        tripId,
        body.exceptionType,
        body.severity,
        body.title,
        body.description,
        JSON.stringify(body.evidence ?? {}),
        body.raisedBy ?? 'dispatcher',
      ],
    );

    const detail = await readTripDispatchDetail(tripId);
    void writeAuditLog({
      actorId: getActorId(req, body.raisedBy ?? 'dispatcher'),
      action: 'trip.exception.create',
      entityType: 'trip_exception',
      entityId: exceptionId,
      payload: {
        tripId,
        exceptionType: body.exceptionType,
        severity: body.severity,
        title: body.title,
      },
    });
    return res.status(201).json(detail);
  } catch (err) {
    next(err);
  }
});

/** POST /api/dispatch/trips/:tripId/exceptions/:exceptionId/status */
dispatchRouter.post('/trips/:tripId/exceptions/:exceptionId/status', requirePermission('dispatch:exception:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params['tripId']!;
    const exceptionId = req.params['exceptionId']!;
    const trip = await readTripLookup(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    const body = updateExceptionStatusBodySchema.parse(req.body);
    const exception = await readTripExceptionLookup(tripId, exceptionId);
    if (!exception) return res.status(404).json({ error: 'trip exception not found' });

    if (!ALLOWED_EXCEPTION_TRANSITIONS[exception.status].includes(body.status)) {
      return res.status(409).json({ error: `invalid exception transition from ${exception.status} to ${body.status}` });
    }

    await getPool().query(
      `UPDATE fleet.trip_exceptions
       SET status = $1,
           acknowledged_at = CASE WHEN $1 = 'ACK' THEN NOW() ELSE acknowledged_at END,
           resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END,
           closed_by = CASE WHEN $1 = 'RESOLVED' THEN COALESCE($2, closed_by) ELSE closed_by END,
           updated_at = NOW()
       WHERE id = $3
         AND trip_id = $4`,
      [body.status, body.closedBy ?? null, exceptionId, tripId],
    );

    const detail = await readTripDispatchDetail(tripId);
    void writeAuditLog({
      actorId: getActorId(req, body.closedBy ?? 'dispatcher'),
      action: 'trip.exception.transition',
      entityType: 'trip_exception',
      entityId: exceptionId,
      payload: {
        tripId,
        fromStatus: exception.status,
        toStatus: body.status,
      },
    });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

function isDriverAssignable(driver: DriverAvailabilityLookup): boolean {
  return driver.isActive && driver.availabilityStatus === 'available';
}

async function readDriverAvailability(driverId: string, excludeTripId?: string): Promise<DriverAvailabilityLookup | null> {
  const result = await getPool().query(
    `SELECT
       id,
       is_active AS "isActive",
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM fleet.trips t
           WHERE t.driver_id = d.id
             AND t.status IN ('planned', 'active', 'paused')
             AND ($2::text IS NULL OR t.id <> $2::text)
         ) THEN 'on_trip'
         ELSE availability_status
       END AS "availabilityStatus"
     FROM fleet.drivers d
     WHERE id = $1`,
    [driverId, excludeTripId ?? null],
  );
  return (result.rows[0] as DriverAvailabilityLookup | undefined) ?? null;
}

async function readTripLookup(tripId: string): Promise<TripLookup | null> {
  const result = await getPool().query(
    `SELECT id, status, vehicle_id AS "vehicleId", driver_id AS "driverId", route_id AS "routeId"
     FROM fleet.trips
     WHERE id = $1`,
    [tripId],
  );
  return (result.rows[0] as TripLookup | undefined) ?? null;
}

async function readTripExceptionLookup(tripId: string, exceptionId: string): Promise<TripExceptionLookup | null> {
  const result = await getPool().query(
    `SELECT id, status
     FROM fleet.trip_exceptions
     WHERE trip_id = $1
       AND id = $2`,
    [tripId, exceptionId],
  );
  return (result.rows[0] as TripExceptionLookup | undefined) ?? null;
}

async function appendTripAssignment(input: {
  tripId: string;
  previousVehicleId: string | null;
  previousDriverId: string | null;
  previousRouteId: string | null;
  newVehicleId: string | null;
  newDriverId: string | null;
  newRouteId: string | null;
  assignedBy: string;
  note: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO fleet.trip_assignments
       (trip_id, previous_vehicle_id, previous_driver_id, previous_route_id, new_vehicle_id, new_driver_id, new_route_id, assigned_by, note, metadata)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      input.tripId,
      input.previousVehicleId,
      input.previousDriverId,
      input.previousRouteId,
      input.newVehicleId,
      input.newDriverId,
      input.newRouteId,
      input.assignedBy,
      input.note,
      JSON.stringify(input.metadata),
    ],
  );
}

async function estimatePlannedEtaAt(routeId: string | undefined, startedAt: Date): Promise<Date | null> {
  if (!routeId) return null;
  const result = await getPool().query(
    `SELECT estimated_duration_sec
     FROM fleet.routes
     WHERE id = $1`,
    [routeId],
  );
  const estimatedDurationSec = Number(result.rows[0]?.['estimated_duration_sec']);
  if (!Number.isFinite(estimatedDurationSec) || estimatedDurationSec <= 0) return null;
  return new Date(startedAt.getTime() + estimatedDurationSec * 1000);
}

async function readTripById(tripId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       t.id,
       t.vehicle_id AS "vehicleId",
       v.vehicle_reg_no AS "vehicleRegNo",
       t.driver_id AS "driverId",
       d.name AS "driverName",
       t.route_id AS "routeId",
       r.name AS "routeName",
       t.status,
       t.started_at AS "startedAt",
       t.ended_at AS "endedAt",
       t.planned_eta_at AS "plannedEtaAt",
       t.start_depot_id AS "startDepotId",
       sd.name AS "startDepotName",
       t.end_depot_id AS "endDepotId",
       ed.name AS "endDepotName",
       t.planned_distance_km AS "plannedDistanceKm",
       t.actual_distance_km AS "actualDistanceKm",
       t.delay_reason AS "delayReason",
       t.end_reason AS "endReason",
       (
         SELECT COUNT(*)::int
         FROM fleet.trip_stops ts
         WHERE ts.trip_id = t.id
       ) AS "stopCount",
       (
         SELECT COUNT(*)::int
         FROM fleet.trip_exceptions te
         WHERE te.trip_id = t.id
           AND te.status <> 'RESOLVED'
       ) AS "openExceptionCount",
       (
         SELECT MAX(ta.assigned_at)
         FROM fleet.trip_assignments ta
         WHERE ta.trip_id = t.id
       ) AS "lastAssignedAt"
     FROM fleet.trips t
     LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
     LEFT JOIN fleet.drivers d ON d.id = t.driver_id
     LEFT JOIN fleet.routes r ON r.id = t.route_id
     LEFT JOIN fleet.depots sd ON sd.id = t.start_depot_id
     LEFT JOIN fleet.depots ed ON ed.id = t.end_depot_id
     WHERE t.id = $1`,
    [tripId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function readTripDispatchDetail(tripId: string): Promise<Record<string, unknown> | null> {
  const trip = await readTripById(tripId);
  if (!trip) return null;

  const [assignmentsResult, exceptionsResult, stopsResult] = await Promise.all([
    getPool().query(
      `SELECT
         id,
         trip_id AS "tripId",
         previous_vehicle_id AS "previousVehicleId",
         previous_driver_id AS "previousDriverId",
         previous_route_id AS "previousRouteId",
         new_vehicle_id AS "newVehicleId",
         new_driver_id AS "newDriverId",
         new_route_id AS "newRouteId",
         assigned_by AS "assignedBy",
         note,
         metadata,
         assigned_at AS "assignedAt",
         created_at AS "createdAt"
       FROM fleet.trip_assignments
       WHERE trip_id = $1
       ORDER BY assigned_at DESC`,
      [tripId],
    ),
    getPool().query(
      `SELECT
         id,
         trip_id AS "tripId",
         exception_type AS "exceptionType",
         severity,
         status,
         title,
         description,
         evidence,
         opened_at AS "openedAt",
         acknowledged_at AS "acknowledgedAt",
         resolved_at AS "resolvedAt",
         raised_by AS "raisedBy",
         closed_by AS "closedBy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM fleet.trip_exceptions
       WHERE trip_id = $1
       ORDER BY opened_at DESC`,
      [tripId],
    ),
    getPool().query(
      `SELECT
         id,
         trip_id AS "tripId",
         seq,
         stop_type AS "stopType",
         lat,
         lng,
         arrived_at AS "arrivedAt",
         departed_at AS "departedAt",
         reason
       FROM fleet.trip_stops
       WHERE trip_id = $1
       ORDER BY seq`,
      [tripId],
    ),
  ]);

  return {
    ...trip,
    assignments: assignmentsResult.rows,
    exceptions: exceptionsResult.rows,
    stops: stopsResult.rows,
  };
}
