import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';

export const reportsRouter = Router();

const reportsWindowSchema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  depotId: z.string().optional(),
});

const dailyReportSchema = z.object({
  date: z.string().date().optional(),
  depotId: z.string().optional(),
});

const exceptionsReportSchema = reportsWindowSchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createWindow(input: z.infer<typeof reportsWindowSchema>): { from: Date; to: Date } {
  const now = new Date();
  const from = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000Z`) : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const to = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : new Date(now);
  return { from, to };
}

/** GET /api/reports/daily */
reportsRouter.get('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dailyReportSchema.parse(req.query);
    const date = query.date ? new Date(`${query.date}T00:00:00.000Z`) : new Date();
    const from = new Date(date);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setUTCHours(23, 59, 59, 999);

    const paramsBase: unknown[] = [from, to];
    const depotFilter = query.depotId ? 'AND v.depot_id = $3' : '';
    if (query.depotId) paramsBase.push(query.depotId);

    const [vehiclesResult, tripsResult, alertsResult, downtimeResult] = await Promise.all([
      getPool().query(
        `SELECT COUNT(*)::int AS "vehicleCount"
         FROM fleet.vehicles v
         WHERE v.is_active = TRUE
           ${query.depotId ? 'AND v.depot_id = $1' : ''}`,
        query.depotId ? [query.depotId] : [],
      ),
      getPool().query(
        `SELECT
           COUNT(*) FILTER (WHERE t.status IN ('completed', 'cancelled'))::int AS "completedTrips",
           COUNT(*) FILTER (WHERE t.status IN ('planned', 'active', 'paused'))::int AS "activeTrips",
           COUNT(*) FILTER (WHERE t.delay_reason IS NOT NULL)::int AS "delayedTrips",
           COUNT(*) FILTER (WHERE t.status = 'completed' AND COALESCE(t.delay_reason, '') = '')::int AS "onTimeTrips",
           COALESCE(SUM(t.actual_distance_km), 0)::numeric AS "distanceKm",
           COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(t.ended_at, $2) - t.started_at)) / 3600), 0)::numeric AS "tripHours"
         FROM fleet.trips t
         LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
         WHERE t.started_at >= $1
           AND t.started_at <= $2
           ${depotFilter}`,
        paramsBase,
      ),
      getPool().query(
        `SELECT
           COUNT(*)::int AS "alertCount",
           COUNT(*) FILTER (WHERE a.status = 'OPEN')::int AS "openAlertCount",
           COUNT(*) FILTER (WHERE a.severity IN ('HIGH', 'CRITICAL'))::int AS "highAlertCount"
         FROM fleet.alerts a
         LEFT JOIN fleet.vehicles v ON v.id = a.vehicle_id
         WHERE a.created_ts >= $1
           AND a.created_ts <= $2
           ${depotFilter}`,
        paramsBase,
      ),
      getPool().query(
        `SELECT
           COALESCE(
             SUM(
               GREATEST(
                 0,
                 EXTRACT(
                   EPOCH FROM (
                     LEAST(COALESCE(wo.closed_at, wo.resolved_at, $2), $2)
                     - GREATEST(COALESCE(wo.started_at, wo.opened_at), $1)
                   )
                 )
               )
             ) / 3600,
             0
           )::numeric AS "downtimeHours"
         FROM fleet.work_orders wo
         LEFT JOIN fleet.vehicles v ON v.id = wo.vehicle_id
         WHERE COALESCE(wo.started_at, wo.opened_at) <= $2
           AND COALESCE(wo.closed_at, wo.resolved_at, $2) >= $1
           ${depotFilter}`,
        paramsBase,
      ),
    ]);

    const vehicleCount = toNumber(vehiclesResult.rows[0]?.['vehicleCount']);
    const completedTrips = toNumber(tripsResult.rows[0]?.['completedTrips']);
    const activeTrips = toNumber(tripsResult.rows[0]?.['activeTrips']);
    const delayedTrips = toNumber(tripsResult.rows[0]?.['delayedTrips']);
    const onTimeTrips = toNumber(tripsResult.rows[0]?.['onTimeTrips']);
    const distanceKm = toNumber(tripsResult.rows[0]?.['distanceKm']);
    const tripHours = toNumber(tripsResult.rows[0]?.['tripHours']);

    const alertCount = toNumber(alertsResult.rows[0]?.['alertCount']);
    const openAlertCount = toNumber(alertsResult.rows[0]?.['openAlertCount']);
    const highAlertCount = toNumber(alertsResult.rows[0]?.['highAlertCount']);
    const downtimeHours = toNumber(downtimeResult.rows[0]?.['downtimeHours']);

    const availableVehicleHours = vehicleCount * 24;
    const utilizationRatePct = availableVehicleHours > 0
      ? Number(((tripHours / availableVehicleHours) * 100).toFixed(2))
      : 0;

    const delayRatePct = completedTrips > 0
      ? Number(((delayedTrips / completedTrips) * 100).toFixed(2))
      : 0;

    const onTimeRatePct = completedTrips > 0
      ? Number(((onTimeTrips / completedTrips) * 100).toFixed(2))
      : 0;

    const alertBurdenPerVehicle = vehicleCount > 0
      ? Number((alertCount / vehicleCount).toFixed(3))
      : 0;

    return res.json({
      date: from.toISOString().slice(0, 10),
      depotId: query.depotId ?? null,
      metrics: {
        vehicleCount,
        activeTrips,
        completedTrips,
        delayedTrips,
        onTimeTrips,
        distanceKm,
        tripHours,
        utilizationRatePct,
        delayRatePct,
        onTimeRatePct,
        alertCount,
        openAlertCount,
        highAlertCount,
        alertBurdenPerVehicle,
        maintenanceDowntimeHours: Number(downtimeHours.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/exceptions */
reportsRouter.get('/exceptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = exceptionsReportSchema.parse(req.query);
    const window = createWindow(query);
    const params: unknown[] = [window.from, window.to];
    let idx = 3;

    const depotFilter = query.depotId ? `AND v.depot_id = $${idx++}` : '';
    if (query.depotId) params.push(query.depotId);

    const dataSql = `
      SELECT
        te.id,
        te.trip_id AS "tripId",
        t.status AS "tripStatus",
        t.driver_id AS "driverId",
        d.name AS "driverName",
        t.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        v.depot_id AS "depotId",
        dp.name AS "depotName",
        te.exception_type AS "exceptionType",
        te.severity,
        te.status,
        te.title,
        te.description,
        te.opened_at AS "openedAt",
        te.acknowledged_at AS "acknowledgedAt",
        te.resolved_at AS "resolvedAt",
        te.closed_by AS "closedBy",
        te.raised_by AS "raisedBy",
        ROUND(
          COALESCE(EXTRACT(EPOCH FROM (COALESCE(te.resolved_at, NOW()) - te.opened_at)) / 60, 0)::numeric,
          1
        ) AS "durationMin"
      FROM fleet.trip_exceptions te
      INNER JOIN fleet.trips t ON t.id = te.trip_id
      LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN fleet.depots dp ON dp.id = v.depot_id
      LEFT JOIN fleet.drivers d ON d.id = t.driver_id
      WHERE te.opened_at >= $1
        AND te.opened_at <= $2
        ${depotFilter}
      ORDER BY te.opened_at DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM fleet.trip_exceptions te
      INNER JOIN fleet.trips t ON t.id = te.trip_id
      LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
      WHERE te.opened_at >= $1
        AND te.opened_at <= $2
        ${depotFilter}
    `;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({
      data: rowsResult.rows,
      total: totalResult.rows[0]?.['total'] ?? 0,
      window: {
        dateFrom: window.from.toISOString(),
        dateTo: window.to.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/utilization */
reportsRouter.get('/utilization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = reportsWindowSchema.parse(req.query);
    const window = createWindow(query);

    const params: unknown[] = [window.from, window.to];
    let idx = 3;

    const depotFilter = query.depotId ? `AND v.depot_id = $${idx++}` : '';
    if (query.depotId) params.push(query.depotId);

    const rowsSql = `
      SELECT
        v.id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        v.vehicle_type AS "vehicleType",
        v.depot_id AS "depotId",
        dp.name AS "depotName",
        COUNT(t.id)::int AS "tripCount",
        COALESCE(SUM(t.actual_distance_km), 0)::numeric AS "distanceKm",
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(t.ended_at, $2) - t.started_at)) / 3600), 0)::numeric AS "tripHours",
        (
          SELECT COUNT(*)::int
          FROM fleet.alerts a
          WHERE a.vehicle_id = v.id
            AND a.created_ts >= $1
            AND a.created_ts <= $2
        ) AS "alertCount",
        (
          SELECT COUNT(*)::int
          FROM fleet.alerts a
          WHERE a.vehicle_id = v.id
            AND a.created_ts >= $1
            AND a.created_ts <= $2
            AND a.severity IN ('HIGH', 'CRITICAL')
        ) AS "highAlertCount",
        (
          SELECT COUNT(*)::int
          FROM fleet.trip_exceptions te
          INNER JOIN fleet.trips tx ON tx.id = te.trip_id
          WHERE tx.vehicle_id = v.id
            AND te.opened_at >= $1
            AND te.opened_at <= $2
        ) AS "exceptionCount"
      FROM fleet.vehicles v
      LEFT JOIN fleet.depots dp ON dp.id = v.depot_id
      LEFT JOIN fleet.trips t
        ON t.vehicle_id = v.id
       AND t.started_at >= $1
       AND t.started_at <= $2
      WHERE v.is_active = TRUE
        ${depotFilter}
      GROUP BY v.id, v.vehicle_reg_no, v.vehicle_type, v.depot_id, dp.name
      ORDER BY "tripHours" DESC, "distanceKm" DESC, v.vehicle_reg_no ASC
    `;

    const rowsResult = await getPool().query(rowsSql, params);
    const periodHours = Math.max(1, (window.to.getTime() - window.from.getTime()) / (1000 * 60 * 60));

    const data = rowsResult.rows.map((row) => {
      const tripHours = toNumber(row['tripHours']);
      const distanceKm = toNumber(row['distanceKm']);
      return {
        vehicleId: row['vehicleId'],
        vehicleRegNo: row['vehicleRegNo'],
        vehicleType: row['vehicleType'],
        depotId: row['depotId'],
        depotName: row['depotName'],
        tripCount: toNumber(row['tripCount']),
        distanceKm,
        tripHours,
        utilizationPct: Number(((tripHours / periodHours) * 100).toFixed(2)),
        avgDistancePerTripKm: toNumber(row['tripCount']) > 0
          ? Number((distanceKm / toNumber(row['tripCount'])).toFixed(2))
          : 0,
        alertCount: toNumber(row['alertCount']),
        highAlertCount: toNumber(row['highAlertCount']),
        exceptionCount: toNumber(row['exceptionCount']),
      };
    });

    return res.json({
      data,
      total: data.length,
      window: {
        dateFrom: window.from.toISOString(),
        dateTo: window.to.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});
