/**
 * Fleet Data Tools — LangChain tools wrapping real DB queries
 * Each tool fetches live data; no LLM hallucination possible at retrieval stage.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';

/* ── Top Drivers ─────────────────────────────────────────────────────────── */
export const getTopDriversTool = tool(
  async ({ limit = 5, depotId }: { limit?: number; depotId?: string }) => {
    const pool = getPool();
    const params: unknown[] = [Math.min(limit, 20)];
    const depotFilter = depotId ? `AND d.depot_id = $${params.push(depotId)}` : '';
    const result = await pool.query(
      `SELECT d.id, d.name, d.licence_class, d.availability,
              d.risk_score, d.shift_score, d.depot_id,
              dep.name AS depot_name
       FROM fleet.drivers d
       LEFT JOIN fleet.depots dep ON dep.id = d.depot_id
       WHERE d.deleted_at IS NULL ${depotFilter}
       ORDER BY d.shift_score DESC NULLS LAST
       LIMIT $1`,
      params,
    );
    return JSON.stringify(result.rows);
  },
  {
    name: 'get_top_drivers',
    description:
      'Get the top performing drivers ranked by shift score. Call this for queries about driver performance, best/top drivers, or driver rankings. Optionally filter by depot.',
    schema: z.object({
      limit: z.number().optional().describe('Number of drivers to return (default 5, max 20)'),
      depotId: z.string().optional().describe('Filter by depot ID, e.g. "depot-mum" or "depot-del"'),
    }),
  },
);

/* ── Open Alerts ─────────────────────────────────────────────────────────── */
export const getOpenAlertsTool = tool(
  async ({ severity, limit = 10 }: { severity?: string; limit?: number }) => {
    const pool = getPool();
    const params: unknown[] = [Math.min(limit, 50)];
    const severityFilter = severity ? `AND a.severity = $${params.push(severity.toUpperCase())}` : '';
    const result = await pool.query(
      `SELECT a.id, a.severity, a.alert_type, a.title, a.status,
              a.created_at, a.acknowledged_at,
              v.reg_no AS vehicle_reg_no, v.id AS vehicle_id
       FROM fleet.alerts a
       LEFT JOIN fleet.vehicles v ON v.id = a.vehicle_id
       WHERE a.status = 'OPEN' ${severityFilter}
       ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                a.created_at ASC
       LIMIT $1`,
      params,
    );
    return JSON.stringify(result.rows);
  },
  {
    name: 'get_open_alerts',
    description:
      'Get currently open fleet alerts. Use for queries about active alerts, incidents, critical issues, alarms, or unresolved problems. Can filter by severity: CRITICAL, HIGH, MEDIUM, LOW.',
    schema: z.object({
      severity: z.string().optional().describe('Filter by severity: CRITICAL, HIGH, MEDIUM, or LOW'),
      limit: z.number().optional().describe('Number of alerts to return (default 10, max 50)'),
    }),
  },
);

/* ── Active Vehicles (On Trip) ───────────────────────────────────────────── */
export const getOnTripVehiclesTool = tool(
  async ({ depotId }: { depotId?: string }) => {
    const pool = getPool();
    const params: unknown[] = [];
    const depotFilter = depotId ? `AND v.depot_id = $${params.push(depotId)}` : '';
    const result = await pool.query(
      `SELECT vls.vehicle_id, v.reg_no, v.vehicle_type, v.depot_id,
              vls.status, vls.speed_kph, vls.fuel_pct,
              vls.lat, vls.lng, vls.updated_at
       FROM fleet.vehicle_latest_state vls
       JOIN fleet.vehicles v ON v.id = vls.vehicle_id
       WHERE LOWER(vls.status) IN ('on_trip', 'alerting') ${depotFilter}
       ORDER BY vls.updated_at DESC`,
      params,
    );
    return JSON.stringify({ count: result.rows.length, vehicles: result.rows });
  },
  {
    name: 'get_on_trip_vehicles',
    description:
      'Get vehicles that are currently on trip or active. Use for queries about how many vehicles are moving, active vehicles, current trips, or fleet utilisation.',
    schema: z.object({
      depotId: z.string().optional().describe('Filter by depot ID'),
    }),
  },
);

/* ── Fleet Summary ───────────────────────────────────────────────────────── */
export const getFleetSummaryTool = tool(
  async () => {
    const pool = getPool();
    const [statusResult, alertResult, driverResult] = await Promise.all([
      pool.query(`
        SELECT LOWER(COALESCE(vls.status, v.status)) AS status, COUNT(*) AS count
        FROM fleet.vehicles v
        LEFT JOIN fleet.vehicle_latest_state vls ON vls.vehicle_id = v.id
        WHERE v.deleted_at IS NULL
        GROUP BY 1
      `),
      pool.query(`
        SELECT severity, COUNT(*) AS count
        FROM fleet.alerts WHERE status = 'OPEN'
        GROUP BY severity
      `),
      pool.query(`
        SELECT availability, COUNT(*) AS count
        FROM fleet.drivers WHERE deleted_at IS NULL
        GROUP BY availability
      `),
    ]);
    return JSON.stringify({
      vehiclesByStatus: statusResult.rows,
      openAlertsBySeverity: alertResult.rows,
      driversByAvailability: driverResult.rows,
    });
  },
  {
    name: 'get_fleet_summary',
    description:
      'Get a broad operational summary of the entire fleet: vehicle counts by status, open alert counts by severity, and driver availability. Use for dashboard questions, daily summaries, or "how are we doing" queries.',
    schema: z.object({}),
  },
);

/* ── Fuel Anomalies ──────────────────────────────────────────────────────── */
export const getFuelAnomaliesTool = tool(
  async ({ limit = 10 }: { limit?: number }) => {
    const pool = getPool();
    const result = await pool.query(
      `SELECT fa.id, fa.anomaly_type, fa.severity, fa.status,
              fa.detected_at, fa.expected_litres, fa.actual_litres,
              v.reg_no AS vehicle_reg_no
       FROM fleet.fuel_anomalies fa
       LEFT JOIN fleet.vehicles v ON v.id = fa.vehicle_id
       WHERE fa.status = 'OPEN'
       ORDER BY fa.detected_at DESC
       LIMIT $1`,
      [Math.min(limit, 30)],
    );
    return JSON.stringify(result.rows);
  },
  {
    name: 'get_fuel_anomalies',
    description:
      'Get open fuel anomalies such as suspected theft, leaks, or misfuelling. Use for queries about fuel issues, anomalies, or fuel-related alerts.',
    schema: z.object({
      limit: z.number().optional().describe('Number of anomalies to return (default 10)'),
    }),
  },
);

/* ── All tools exported ──────────────────────────────────────────────────── */
export const allFleetTools = [
  getTopDriversTool,
  getOpenAlertsTool,
  getOnTripVehiclesTool,
  getFleetSummaryTool,
  getFuelAnomaliesTool,
];
