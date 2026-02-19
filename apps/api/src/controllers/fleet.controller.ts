import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  PgVehicleRepository,
  PgTelemetryRepository,
  PgAlertRepository,
} from '@ai-fleet/adapters';
import { getPool } from '@ai-fleet/adapters';
import type { VehicleListFilters } from '@ai-fleet/domain';

export const fleetRouter = Router();

const listQuerySchema = z.object({
  depotId: z.string().uuid().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const tripsQuerySchema = z.object({
  vehicleId: z.string().optional(),
  status: z
    .enum(['planned', 'active', 'paused', 'completed', 'cancelled'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/fleet/mode - current fleet mode and active scenario run */
fleetRouter.get('/mode', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await getPool().query(
      `SELECT current_mode AS mode, active_scenario_run_id AS active_run_id, updated_at FROM fleet.fleet_runtime_state WHERE id = 1`,
    );
    res.json(rows[0] ?? { mode: 'idle', active_run_id: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles */
fleetRouter.get('/vehicles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const repo = new PgVehicleRepository();
    const vehicles = await repo.list(query as VehicleListFilters);
    res.json({ data: vehicles, total: vehicles.length });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/states - all vehicle latest states (lat/lng/speed for map) */
fleetRouter.get('/states', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgVehicleRepository();
    const states = await repo.listLatestStates();
    res.json({ data: states });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/inventory - dashboard inventory summary */
fleetRouter.get('/inventory', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalsResult, byTypeResult, byDepotResult] = await Promise.all([
      getPool().query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'on_trip')::int AS on_trip,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'idle')::int AS idle,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'parked')::int AS parked,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'alerting')::int AS alerting,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'maintenance_due')::int AS maintenance_due
         FROM fleet.vehicles v
         LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = v.id
         WHERE v.is_active = TRUE`,
      ),
      getPool().query(
        `SELECT
           v.vehicle_type AS "vehicleType",
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'on_trip')::int AS "onTrip",
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'idle')::int AS idle,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'parked')::int AS parked
         FROM fleet.vehicles v
         LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = v.id
         WHERE v.is_active = TRUE
         GROUP BY v.vehicle_type
         ORDER BY v.vehicle_type`,
      ),
      getPool().query(
        `SELECT
           v.depot_id AS "depotId",
           d.name AS "depotName",
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'on_trip')::int AS "onTrip",
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'idle')::int AS idle,
           COUNT(*) FILTER (WHERE COALESCE(vls.status, v.status) = 'parked')::int AS parked
         FROM fleet.vehicles v
         LEFT JOIN fleet.depots d ON d.id = v.depot_id
         LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = v.id
         WHERE v.is_active = TRUE
         GROUP BY v.depot_id, d.name
         ORDER BY count DESC, v.depot_id`,
      ),
    ]);

    const [activeTripsResult, completedTripsResult] = await Promise.all([
      getPool().query(
        `SELECT COUNT(*)::int AS count FROM fleet.trips WHERE status IN ('active', 'paused', 'planned')`,
      ),
      getPool().query(
        `SELECT COUNT(*)::int AS count FROM fleet.trips WHERE status IN ('completed', 'cancelled')`,
      ),
    ]);

    const totals = totalsResult.rows[0] ?? {};
    return res.json({
      totals: {
        total: totals['total'] ?? 0,
        onTrip: totals['on_trip'] ?? 0,
        idle: totals['idle'] ?? 0,
        parked: totals['parked'] ?? 0,
        alerting: totals['alerting'] ?? 0,
        maintenanceDue: totals['maintenance_due'] ?? 0,
        activeTrips: activeTripsResult.rows[0]?.['count'] ?? 0,
        completedTrips: completedTripsResult.rows[0]?.['count'] ?? 0,
      },
      byType: byTypeResult.rows,
      byDepot: byDepotResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/trips - fleet trip history with filters */
fleetRouter.get('/trips', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = tripsQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`t.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.status) {
      where.push(`t.status = $${idx++}`);
      params.push(query.status);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        t.id,
        t.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        t.driver_id AS "driverId",
        d.name AS "driverName",
        t.route_id AS "routeId",
        r.name AS "routeName",
        t.scenario_run_id AS "scenarioRunId",
        t.status,
        t.started_at AS "startedAt",
        t.ended_at AS "endedAt",
        t.start_depot_id AS "startDepotId",
        sd.name AS "startDepotName",
        t.end_depot_id AS "endDepotId",
        ed.name AS "endDepotName",
        t.planned_distance_km AS "plannedDistanceKm",
        t.actual_distance_km AS "actualDistanceKm",
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
      ${whereSql}
      ORDER BY t.started_at DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;

    const countQuery = `SELECT COUNT(*)::int AS total FROM fleet.trips t ${whereSql}`;
    const dataParams = [...params, query.limit, query.offset];

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataQuery, dataParams),
      getPool().query(countQuery, params),
    ]);

    return res.json({ data: rowsResult.rows, total: totalResult.rows[0]?.['total'] ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/trips/:tripId - trip detail with stops */
fleetRouter.get('/trips/:tripId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params['tripId']!;
    const tripResult = await getPool().query(
      `SELECT
         t.id,
         t.vehicle_id AS "vehicleId",
         v.vehicle_reg_no AS "vehicleRegNo",
         t.driver_id AS "driverId",
         d.name AS "driverName",
         t.route_id AS "routeId",
         r.name AS "routeName",
         t.scenario_run_id AS "scenarioRunId",
         t.status,
         t.started_at AS "startedAt",
         t.ended_at AS "endedAt",
         t.start_depot_id AS "startDepotId",
         sd.name AS "startDepotName",
         t.end_depot_id AS "endDepotId",
         ed.name AS "endDepotName",
         t.planned_distance_km AS "plannedDistanceKm",
         t.actual_distance_km AS "actualDistanceKm",
         t.end_reason AS "endReason"
       FROM fleet.trips t
       LEFT JOIN fleet.vehicles v ON v.id = t.vehicle_id
       LEFT JOIN fleet.drivers d ON d.id = t.driver_id
       LEFT JOIN fleet.routes r ON r.id = t.route_id
       LEFT JOIN fleet.depots sd ON sd.id = t.start_depot_id
       LEFT JOIN fleet.depots ed ON ed.id = t.end_depot_id
       WHERE t.id = $1`,
      [tripId],
    );

    const trip = tripResult.rows[0];
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    const stopsResult = await getPool().query(
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
    );

    return res.json({ ...trip, stops: stopsResult.rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles/:vehicleId */
fleetRouter.get('/vehicles/:vehicleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vehicleRepo = new PgVehicleRepository();
    const vehicle = await vehicleRepo.findById(req.params['vehicleId']!);
    if (!vehicle) return res.status(404).json({ error: 'vehicle not found' });

    const telemetryRepo = new PgTelemetryRepository();
    const alertRepo = new PgAlertRepository();

    const [latestTelemetry, activeAlerts, currentTripResult, previousTripsResult] = await Promise.all([
      telemetryRepo.readLatestN(vehicle.id, 10),
      alertRepo.listAlerts({ vehicleId: vehicle.id, status: 'OPEN' }),
      getPool().query(
        `SELECT
           t.id,
           t.vehicle_id AS "vehicleId",
           v.vehicle_reg_no AS "vehicleRegNo",
           t.driver_id AS "driverId",
           d.name AS "driverName",
           t.route_id AS "routeId",
           r.name AS "routeName",
           t.scenario_run_id AS "scenarioRunId",
           t.status,
           t.started_at AS "startedAt",
           t.ended_at AS "endedAt",
           t.start_depot_id AS "startDepotId",
           sd.name AS "startDepotName",
           t.end_depot_id AS "endDepotId",
           ed.name AS "endDepotName",
           t.planned_distance_km AS "plannedDistanceKm",
           t.actual_distance_km AS "actualDistanceKm",
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
         WHERE t.vehicle_id = $1
           AND t.status IN ('planned', 'active', 'paused')
         ORDER BY t.started_at DESC
         LIMIT 1`,
        [vehicle.id],
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
           t.scenario_run_id AS "scenarioRunId",
           t.status,
           t.started_at AS "startedAt",
           t.ended_at AS "endedAt",
           t.start_depot_id AS "startDepotId",
           sd.name AS "startDepotName",
           t.end_depot_id AS "endDepotId",
           ed.name AS "endDepotName",
           t.planned_distance_km AS "plannedDistanceKm",
           t.actual_distance_km AS "actualDistanceKm",
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
         WHERE t.vehicle_id = $1
           AND t.status IN ('completed', 'cancelled')
         ORDER BY t.started_at DESC
         LIMIT 8`,
        [vehicle.id],
      ),
    ]);

    return res.json({
      vehicle,
      latestTelemetry,
      activeAlerts,
      currentTrip: currentTripResult.rows[0] ?? null,
      previousTrips: previousTripsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles/:vehicleId/state */
fleetRouter.get('/vehicles/:vehicleId/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgVehicleRepository();
    const state = await repo.getLatestState(req.params['vehicleId']!);
    if (!state) return res.status(404).json({ error: 'state not found' });
    return res.json(state);
  } catch (err) {
    next(err);
  }
});
