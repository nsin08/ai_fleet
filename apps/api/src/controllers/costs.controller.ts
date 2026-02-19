import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';
import { getActorId, requirePermission } from '../middleware/rbac.js';
import { writeAuditLog } from '../services/audit-log.service.js';

export const fuelRouter = Router();
export const costsRouter = Router();

const fuelAnomalyStatusSchema = z.enum(['OPEN', 'CONFIRMED', 'DISMISSED', 'RESOLVED']);
const fuelSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const listFuelAnomaliesQuerySchema = z.object({
  vehicleId: z.string().optional(),
  depotId: z.string().optional(),
  status: fuelAnomalyStatusSchema.optional(),
  severity: fuelSeveritySchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const dispositionFuelAnomalyBodySchema = z.object({
  status: z.enum(['CONFIRMED', 'DISMISSED', 'RESOLVED']),
  note: z.string().max(500).optional(),
  actorId: z.string().max(120).optional(),
});

const listCostsQuerySchema = z.object({
  vehicleId: z.string().optional(),
  depotId: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

const listCostsByVehicleQuerySchema = listCostsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ALLOWED_ANOMALY_TRANSITIONS: Record<
  z.infer<typeof fuelAnomalyStatusSchema>,
  z.infer<typeof fuelAnomalyStatusSchema>[]
> = {
  OPEN: ['CONFIRMED', 'DISMISSED'],
  CONFIRMED: ['RESOLVED', 'DISMISSED'],
  DISMISSED: ['CONFIRMED'],
  RESOLVED: [],
};

interface CostFilterInput {
  vehicleId?: string;
  depotId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface FuelEventLookup {
  id: string;
  eventType: 'consumption' | 'refuel' | 'anomaly';
  status: z.infer<typeof fuelAnomalyStatusSchema>;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapFuelEventRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    fuelDeltaPct: toNumber(row['fuelDeltaPct']),
    estimatedLiters: row['estimatedLiters'] == null ? null : toNumber(row['estimatedLiters']),
    anomalyScore: row['anomalyScore'] == null ? null : toNumber(row['anomalyScore']),
  };
}

function buildCostFilters(query: CostFilterInput): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [];
  let idx = 1;

  if (query.vehicleId) {
    where.push(`ce.vehicle_id = $${idx++}`);
    params.push(query.vehicleId);
  }
  if (query.depotId) {
    where.push(`ce.depot_id = $${idx++}`);
    params.push(query.depotId);
  }
  if (query.dateFrom) {
    where.push(`ce.ts >= $${idx++}::date`);
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    where.push(`ce.ts < ($${idx++}::date + INTERVAL '1 day')`);
    params.push(query.dateTo);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

/** GET /api/fuel/anomalies */
fuelRouter.get('/anomalies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listFuelAnomaliesQuerySchema.parse(req.query);
    const params: unknown[] = [];
    const where: string[] = [`fe.event_type = 'anomaly'`];
    let idx = 1;

    if (query.vehicleId) {
      where.push(`fe.vehicle_id = $${idx++}`);
      params.push(query.vehicleId);
    }
    if (query.depotId) {
      where.push(`fe.depot_id = $${idx++}`);
      params.push(query.depotId);
    }
    if (query.status) {
      where.push(`fe.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.severity) {
      where.push(`fe.severity = $${idx++}`);
      params.push(query.severity);
    }
    if (query.dateFrom) {
      where.push(`fe.ts >= $${idx++}::date`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      where.push(`fe.ts < ($${idx++}::date + INTERVAL '1 day')`);
      params.push(query.dateTo);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const dataSql = `
      SELECT
        fe.id,
        fe.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        fe.trip_id AS "tripId",
        fe.depot_id AS "depotId",
        d.name AS "depotName",
        fe.event_type AS "eventType",
        fe.severity,
        fe.fuel_delta_pct AS "fuelDeltaPct",
        fe.estimated_liters AS "estimatedLiters",
        fe.anomaly_score AS "anomalyScore",
        fe.status,
        fe.evidence,
        fe.disposition_note AS "dispositionNote",
        fe.dispositioned_by AS "dispositionedBy",
        fe.dispositioned_at AS "dispositionedAt",
        fe.ts,
        fe.created_at AS "createdAt",
        fe.updated_at AS "updatedAt"
      FROM fleet.fuel_events fe
      LEFT JOIN fleet.vehicles v ON v.id = fe.vehicle_id
      LEFT JOIN fleet.depots d ON d.id = fe.depot_id
      ${whereSql}
      ORDER BY
        CASE fe.status
          WHEN 'OPEN' THEN 1
          WHEN 'CONFIRMED' THEN 2
          WHEN 'DISMISSED' THEN 3
          ELSE 4
        END,
        CASE fe.severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          ELSE 4
        END,
        fe.ts DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM fleet.fuel_events fe
      ${whereSql}
    `;

    const statsSql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE fe.status = 'OPEN')::int AS open,
        COUNT(*) FILTER (WHERE fe.status = 'CONFIRMED')::int AS confirmed,
        COUNT(*) FILTER (WHERE fe.status = 'DISMISSED')::int AS dismissed,
        COUNT(*) FILTER (WHERE fe.status = 'RESOLVED')::int AS resolved,
        COUNT(*) FILTER (WHERE fe.status = 'OPEN' AND fe.severity IN ('HIGH', 'CRITICAL'))::int AS "highRiskOpen"
      FROM fleet.fuel_events fe
      ${whereSql}
    `;

    const dataParams = [...params, query.limit, query.offset];

    const [rowsResult, totalResult, statsResult] = await Promise.all([
      getPool().query(dataSql, dataParams),
      getPool().query(countSql, params),
      getPool().query(statsSql, params),
    ]);

    const data = rowsResult.rows.map((row) => mapFuelEventRow(row as Record<string, unknown>));

    return res.json({
      data,
      total: totalResult.rows[0]?.['total'] ?? 0,
      stats: statsResult.rows[0] ?? {
        total: 0,
        open: 0,
        confirmed: 0,
        dismissed: 0,
        resolved: 0,
        highRiskOpen: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/fuel/anomalies/:eventId/disposition */
fuelRouter.post('/anomalies/:eventId/disposition', requirePermission('fuel:anomaly:disposition'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params['eventId']!;
    const body = dispositionFuelAnomalyBodySchema.parse(req.body);

    const lookup = await readFuelEventLookup(eventId);
    if (!lookup) return res.status(404).json({ error: 'fuel anomaly not found' });
    if (lookup.eventType !== 'anomaly') return res.status(409).json({ error: 'event is not an anomaly' });

    if (lookup.status === body.status) {
      const same = await readFuelEventById(eventId);
      return res.json(same);
    }

    if (!ALLOWED_ANOMALY_TRANSITIONS[lookup.status].includes(body.status)) {
      return res.status(409).json({
        error: `invalid anomaly transition from ${lookup.status} to ${body.status}`,
      });
    }

    await getPool().query(
      `UPDATE fleet.fuel_events
       SET status = $1,
           disposition_note = COALESCE($2, disposition_note),
           dispositioned_by = COALESCE($3, dispositioned_by),
           dispositioned_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [body.status, body.note ?? null, body.actorId ?? 'ops-console', eventId],
    );

    const updated = await readFuelEventById(eventId);
    void writeAuditLog({
      actorId: getActorId(req, body.actorId ?? 'ops-console'),
      action: 'fuel.anomaly.disposition',
      entityType: 'fuel_event',
      entityId: eventId,
      payload: {
        fromStatus: lookup.status,
        toStatus: body.status,
        note: body.note ?? null,
      },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /api/costs/summary */
costsRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listCostsQuerySchema.parse(req.query);
    const { whereSql, params } = buildCostFilters(query);

    const summarySql = `
      SELECT
        COALESCE(SUM(ce.amount), 0)::numeric AS "totalCost",
        COALESCE(SUM(ce.distance_km), 0)::numeric AS "totalDistanceKm",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'idle' THEN ce.amount ELSE 0 END), 0)::numeric AS "idleCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'fuel' THEN ce.amount ELSE 0 END), 0)::numeric AS "fuelCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'maintenance' THEN ce.amount ELSE 0 END), 0)::numeric AS "maintenanceCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'driver' THEN ce.amount ELSE 0 END), 0)::numeric AS "driverCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'toll' THEN ce.amount ELSE 0 END), 0)::numeric AS "tollCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'other' THEN ce.amount ELSE 0 END), 0)::numeric AS "otherCost",
        COUNT(*)::int AS "entryCount",
        COUNT(DISTINCT ce.trip_id)::int AS "tripCount"
      FROM fleet.cost_entries ce
      ${whereSql}
    `;

    const trendSql = `
      SELECT
        DATE_TRUNC('day', ce.ts)::date AS day,
        COALESCE(SUM(ce.amount), 0)::numeric AS "totalCost",
        COALESCE(SUM(ce.distance_km), 0)::numeric AS "distanceKm",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'idle' THEN ce.amount ELSE 0 END), 0)::numeric AS "idleCost"
      FROM fleet.cost_entries ce
      ${whereSql}
      GROUP BY DATE_TRUNC('day', ce.ts)::date
      ORDER BY day DESC
      LIMIT 30
    `;

    const [summaryResult, trendResult] = await Promise.all([
      getPool().query(summarySql, params),
      getPool().query(trendSql, params),
    ]);

    const summaryRow = (summaryResult.rows[0] as Record<string, unknown> | undefined) ?? {};
    const totalCost = toNumber(summaryRow['totalCost']);
    const totalDistanceKm = toNumber(summaryRow['totalDistanceKm']);
    const idleCost = toNumber(summaryRow['idleCost']);

    const trend = trendResult.rows
      .map((row) => {
        const total = toNumber(row['totalCost']);
        const distance = toNumber(row['distanceKm']);
        const idle = toNumber(row['idleCost']);
        return {
          day: row['day'],
          totalCost: total,
          distanceKm: distance,
          idleCost: idle,
          costPerKm: distance > 0 ? Number((total / distance).toFixed(2)) : 0,
          idleCostRatio: total > 0 ? Number((idle / total).toFixed(4)) : 0,
        };
      })
      .reverse();

    return res.json({
      totalCost,
      totalDistanceKm,
      costPerKm: totalDistanceKm > 0 ? Number((totalCost / totalDistanceKm).toFixed(2)) : 0,
      idleCost,
      idleCostRatio: totalCost > 0 ? Number((idleCost / totalCost).toFixed(4)) : 0,
      fuelCost: toNumber(summaryRow['fuelCost']),
      maintenanceCost: toNumber(summaryRow['maintenanceCost']),
      driverCost: toNumber(summaryRow['driverCost']),
      tollCost: toNumber(summaryRow['tollCost']),
      otherCost: toNumber(summaryRow['otherCost']),
      entryCount: toNumber(summaryRow['entryCount']),
      tripCount: toNumber(summaryRow['tripCount']),
      trend,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/costs/by-vehicle */
costsRouter.get('/by-vehicle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listCostsByVehicleQuerySchema.parse(req.query);
    const { whereSql, params } = buildCostFilters(query);

    const dataSql = `
      SELECT
        ce.vehicle_id AS "vehicleId",
        v.vehicle_reg_no AS "vehicleRegNo",
        v.vehicle_type AS "vehicleType",
        ce.depot_id AS "depotId",
        d.name AS "depotName",
        COALESCE(SUM(ce.amount), 0)::numeric AS "totalCost",
        COALESCE(SUM(ce.distance_km), 0)::numeric AS "totalDistanceKm",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'idle' THEN ce.amount ELSE 0 END), 0)::numeric AS "idleCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'fuel' THEN ce.amount ELSE 0 END), 0)::numeric AS "fuelCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'maintenance' THEN ce.amount ELSE 0 END), 0)::numeric AS "maintenanceCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'driver' THEN ce.amount ELSE 0 END), 0)::numeric AS "driverCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'toll' THEN ce.amount ELSE 0 END), 0)::numeric AS "tollCost",
        COALESCE(SUM(CASE WHEN ce.cost_type = 'other' THEN ce.amount ELSE 0 END), 0)::numeric AS "otherCost",
        COUNT(DISTINCT ce.trip_id)::int AS "tripCount",
        MAX(ce.ts) AS "lastEntryAt"
      FROM fleet.cost_entries ce
      INNER JOIN fleet.vehicles v ON v.id = ce.vehicle_id
      LEFT JOIN fleet.depots d ON d.id = ce.depot_id
      ${whereSql}
      GROUP BY ce.vehicle_id, v.vehicle_reg_no, v.vehicle_type, ce.depot_id, d.name
      ORDER BY SUM(ce.amount) DESC, ce.vehicle_id
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT ce.vehicle_id
        FROM fleet.cost_entries ce
        ${whereSql}
        GROUP BY ce.vehicle_id
      ) grouped
    `;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    const data = rowsResult.rows.map((row) => {
      const totalCost = toNumber(row['totalCost']);
      const totalDistanceKm = toNumber(row['totalDistanceKm']);
      const idleCost = toNumber(row['idleCost']);
      return {
        vehicleId: row['vehicleId'],
        vehicleRegNo: row['vehicleRegNo'],
        vehicleType: row['vehicleType'],
        depotId: row['depotId'],
        depotName: row['depotName'],
        totalCost,
        totalDistanceKm,
        costPerKm: totalDistanceKm > 0 ? Number((totalCost / totalDistanceKm).toFixed(2)) : 0,
        idleCost,
        idleCostRatio: totalCost > 0 ? Number((idleCost / totalCost).toFixed(4)) : 0,
        fuelCost: toNumber(row['fuelCost']),
        maintenanceCost: toNumber(row['maintenanceCost']),
        driverCost: toNumber(row['driverCost']),
        tollCost: toNumber(row['tollCost']),
        otherCost: toNumber(row['otherCost']),
        tripCount: toNumber(row['tripCount']),
        lastEntryAt: row['lastEntryAt'],
      };
    });

    return res.json({
      data,
      total: totalResult.rows[0]?.['total'] ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

async function readFuelEventLookup(eventId: string): Promise<FuelEventLookup | null> {
  const result = await getPool().query(
    `SELECT
       id,
       event_type AS "eventType",
       status
     FROM fleet.fuel_events
     WHERE id = $1`,
    [eventId],
  );
  return (result.rows[0] as FuelEventLookup | undefined) ?? null;
}

async function readFuelEventById(eventId: string): Promise<Record<string, unknown> | null> {
  const result = await getPool().query(
    `SELECT
       fe.id,
       fe.vehicle_id AS "vehicleId",
       v.vehicle_reg_no AS "vehicleRegNo",
       fe.trip_id AS "tripId",
       fe.depot_id AS "depotId",
       d.name AS "depotName",
       fe.event_type AS "eventType",
       fe.severity,
       fe.fuel_delta_pct AS "fuelDeltaPct",
       fe.estimated_liters AS "estimatedLiters",
       fe.anomaly_score AS "anomalyScore",
       fe.status,
       fe.evidence,
       fe.disposition_note AS "dispositionNote",
       fe.dispositioned_by AS "dispositionedBy",
       fe.dispositioned_at AS "dispositionedAt",
       fe.ts,
       fe.created_at AS "createdAt",
       fe.updated_at AS "updatedAt"
     FROM fleet.fuel_events fe
     LEFT JOIN fleet.vehicles v ON v.id = fe.vehicle_id
     LEFT JOIN fleet.depots d ON d.id = fe.depot_id
     WHERE fe.id = $1`,
    [eventId],
  );
  const row = (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  return row ? mapFuelEventRow(row) : null;
}
