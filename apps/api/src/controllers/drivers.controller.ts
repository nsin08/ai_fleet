import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';

export const driversRouter = Router();

const availabilitySchema = z.enum(['available', 'on_trip', 'off_shift', 'leave']);
const riskSchema = z.enum(['low', 'medium', 'high']);

const listDriversQuerySchema = z.object({
  availability: availabilitySchema.optional(),
  risk: riskSchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function normalizeAvailabilityStatus(
  raw: string,
  hasActiveTrip: boolean,
): z.infer<typeof availabilitySchema> {
  if (hasActiveTrip) return 'on_trip';
  if (raw === 'on_trip') return 'available';
  return availabilitySchema.parse(raw);
}

function riskSqlCondition(risk: z.infer<typeof riskSchema> | undefined): string | null {
  if (!risk) return null;
  if (risk === 'high') return 'd.current_safety_score < 60';
  if (risk === 'medium') return 'd.current_safety_score >= 60 AND d.current_safety_score < 80';
  return 'd.current_safety_score >= 80';
}

function riskBandFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score < 60) return 'high';
  if (score < 80) return 'medium';
  return 'low';
}

function buildScoreTrend(base: number, current: number): Array<{ ts: string; score: number }> {
  const points = 7;
  return Array.from({ length: points }, (_v, idx) => {
    const remainingDays = points - 1 - idx;
    const ratio = idx / (points - 1);
    const ts = new Date(Date.now() - remainingDays * 24 * 60 * 60 * 1000).toISOString();
    const score = Math.round(base + (current - base) * ratio);
    return { ts, score };
  });
}

async function readDriverCore(driverId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       d.id,
       d.name,
       d.license_id AS "licenseId",
       d.phone,
       d.base_safety_score::int AS "baseSafetyScore",
       d.current_safety_score::int AS "currentSafetyScore",
       d.availability_status AS "availabilityStatus",
       d.shift_start_local::text AS "shiftStartLocal",
       d.shift_end_local::text AS "shiftEndLocal",
       d.availability_updated_at AS "availabilityUpdatedAt",
       d.is_active AS "isActive"
     FROM fleet.drivers d
     WHERE d.id = $1`,
    [driverId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

/** GET /api/drivers */
driversRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listDriversQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.availability) {
      if (query.availability === 'on_trip') {
        where.push(`EXISTS (
          SELECT 1
          FROM fleet.trips t_av
          WHERE t_av.driver_id = d.id
            AND t_av.status IN ('planned', 'active', 'paused')
        )`);
      } else if (query.availability === 'available') {
        where.push(`d.availability_status = $${idx++}`);
        params.push('available');
        where.push(`NOT EXISTS (
          SELECT 1
          FROM fleet.trips t_av
          WHERE t_av.driver_id = d.id
            AND t_av.status IN ('planned', 'active', 'paused')
        )`);
      } else {
        where.push(`d.availability_status = $${idx++}`);
        params.push(query.availability);
      }
    }

    const riskCondition = riskSqlCondition(query.risk);
    if (riskCondition) where.push(riskCondition);

    if (query.q) {
      where.push(`(d.id ILIKE $${idx} OR d.name ILIKE $${idx} OR d.license_id ILIKE $${idx})`);
      params.push(`%${query.q}%`);
      idx += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        d.id,
        d.name,
        d.license_id AS "licenseId",
        d.phone,
        d.base_safety_score::int AS "baseSafetyScore",
        d.current_safety_score::int AS "currentSafetyScore",
        CASE
          WHEN current_trip.id IS NOT NULL THEN 'on_trip'
          WHEN d.availability_status = 'on_trip' THEN 'available'
          ELSE d.availability_status
        END AS "availabilityStatus",
        d.shift_start_local::text AS "shiftStartLocal",
        d.shift_end_local::text AS "shiftEndLocal",
        d.availability_updated_at AS "availabilityUpdatedAt",
        d.is_active AS "isActive",
        CASE
          WHEN d.current_safety_score < 60 THEN 'high'
          WHEN d.current_safety_score < 80 THEN 'medium'
          ELSE 'low'
        END AS "riskBand",
        (d.is_active = TRUE AND d.availability_status = 'available' AND current_trip.id IS NULL) AS "isAssignable",
        (
          SELECT COUNT(*)::int
          FROM fleet.trips t
          WHERE t.driver_id = d.id
            AND t.status IN ('planned', 'active', 'paused')
        ) AS "activeTripCount",
        current_trip.id AS "currentTripId",
        current_trip.vehicle_id AS "currentVehicleId",
        current_trip.vehicle_reg_no AS "currentVehicleRegNo",
        current_trip.started_at AS "currentTripStartedAt",
        (
          SELECT COUNT(*)::int
          FROM fleet.alerts a
          WHERE a.driver_id = d.id
            AND a.status = 'OPEN'
        ) AS "openAlertCount",
        (
          SELECT MAX(t.started_at)
          FROM fleet.trips t
          WHERE t.driver_id = d.id
        ) AS "lastTripAt"
      FROM fleet.drivers d
      LEFT JOIN LATERAL (
        SELECT
          t.id,
          t.vehicle_id,
          v.vehicle_reg_no,
          t.started_at
        FROM fleet.trips t
        LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
        WHERE t.driver_id = d.id
          AND t.status IN ('planned', 'active', 'paused')
        ORDER BY t.started_at DESC
        LIMIT 1
      ) current_trip ON TRUE
      ${whereSql}
      ORDER BY d.current_safety_score ASC, d.name ASC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;

    const countSql = `SELECT COUNT(*)::int AS total FROM fleet.drivers d ${whereSql}`;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/drivers/:driverId */
driversRouter.get('/:driverId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = req.params['driverId']!;
    const driver = await readDriverCore(driverId);
    if (!driver) return res.status(404).json({ error: 'driver not found' });

    const [currentTripResult, recentTripsResult, recentAlertsResult, recentEventsResult] = await Promise.all([
      getPool().query(
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
           ) AS "stopCount"
         FROM fleet.trips t
         LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
         LEFT JOIN fleet.drivers d ON d.id = t.driver_id
         LEFT JOIN fleet.routes r ON r.id = t.route_id
         LEFT JOIN fleet.depots sd ON sd.id = t.start_depot_id
         LEFT JOIN fleet.depots ed ON ed.id = t.end_depot_id
         WHERE t.driver_id = $1
           AND t.status IN ('planned', 'active', 'paused')
         ORDER BY t.started_at DESC
         LIMIT 1`,
        [driverId],
      ),
      getPool().query(
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
           ) AS "stopCount"
         FROM fleet.trips t
         LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
         LEFT JOIN fleet.drivers d ON d.id = t.driver_id
         LEFT JOIN fleet.routes r ON r.id = t.route_id
         LEFT JOIN fleet.depots sd ON sd.id = t.start_depot_id
         LEFT JOIN fleet.depots ed ON ed.id = t.end_depot_id
         WHERE t.driver_id = $1
           AND t.status IN ('completed', 'cancelled')
         ORDER BY t.started_at DESC
         LIMIT 8`,
        [driverId],
      ),
      getPool().query(
        `SELECT
           id,
           created_ts AS "createdTs",
           updated_ts AS "updatedTs",
           closed_ts AS "closedTs",
           vehicle_id AS "vehicleId",
           vehicle_reg_no AS "vehicleRegNo",
           driver_id AS "driverId",
           trip_id AS "tripId",
           scenario_run_id AS "scenarioRunId",
           alert_type AS "alertType",
           severity,
           status,
           title,
           description,
           evidence,
           related_event_ids AS "relatedEventIds",
           acknowledged_by AS "acknowledgedBy",
           acknowledged_ts AS "acknowledgedTs",
           note,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM fleet.alerts
         WHERE driver_id = $1
         ORDER BY created_ts DESC
         LIMIT 10`,
        [driverId],
      ),
      getPool().query(
        `SELECT
           id,
           ts,
           vehicle_id AS "vehicleId",
           vehicle_reg_no AS "vehicleRegNo",
           driver_id AS "driverId",
           trip_id AS "tripId",
           scenario_run_id AS "scenarioRunId",
           source_mode AS "sourceMode",
           source_emitter_id AS "sourceEmitterId",
           source,
           event_type AS "eventType",
           severity,
           message,
           metadata,
           created_at AS "createdAt"
         FROM fleet.events
         WHERE driver_id = $1
         ORDER BY ts DESC
         LIMIT 10`,
        [driverId],
      ),
    ]);

    const baseScore = Number(driver['baseSafetyScore']);
    const currentScore = Number(driver['currentSafetyScore']);
    const hasActiveTrip = currentTripResult.rows.length > 0;
    const availabilityStatus = normalizeAvailabilityStatus(
      String(driver['availabilityStatus']),
      hasActiveTrip,
    );

    return res.json({
      ...driver,
      availabilityStatus,
      riskBand: riskBandFromScore(currentScore),
      isAssignable: driver['isActive'] === true && availabilityStatus === 'available',
      scoreTrend: buildScoreTrend(baseScore, currentScore),
      currentTrip: currentTripResult.rows[0] ?? null,
      recentTrips: recentTripsResult.rows,
      recentAlerts: recentAlertsResult.rows,
      recentEvents: recentEventsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/drivers/:driverId/score */
driversRouter.get('/:driverId/score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = req.params['driverId']!;
    const driver = await readDriverCore(driverId);
    if (!driver) return res.status(404).json({ error: 'driver not found' });
    const activeTripResult = await getPool().query(
      `SELECT 1
       FROM fleet.trips
       WHERE driver_id = $1
         AND status IN ('planned', 'active', 'paused')
       LIMIT 1`,
      [driverId],
    );
    const availabilityStatus = normalizeAvailabilityStatus(
      String(driver['availabilityStatus']),
      activeTripResult.rows.length > 0,
    );

    const baseScore = Number(driver['baseSafetyScore']);
    const currentScore = Number(driver['currentSafetyScore']);
    const riskBand = riskBandFromScore(currentScore);
    const delta = currentScore - baseScore;

    return res.json({
      driverId,
      baseSafetyScore: baseScore,
      currentSafetyScore: currentScore,
      delta,
      riskBand,
      availabilityStatus,
      isAssignable: driver['isActive'] === true && availabilityStatus === 'available',
      scoreTrend: buildScoreTrend(baseScore, currentScore),
    });
  } catch (err) {
    next(err);
  }
});
