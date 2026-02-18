import type {
  TelemetryRepositoryPort,
  TelemetrySliceQuery,
} from '@ai-fleet/domain';
import type { TelemetryPoint, TelemetrySourceMode } from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgTelemetryRepository implements TelemetryRepositoryPort {
  async readSlice(query: TelemetrySliceQuery): Promise<TelemetryPoint[]> {
    const params: unknown[] = [query.vehicleId, query.from, query.to];
    let sql = `
      SELECT * FROM fleet.telemetry_points
      WHERE vehicle_id = $1
        AND ts >= $2
        AND ts <= $3
    `;
    if (query.sourceMode) {
      sql += ` AND source_mode = $4`;
      params.push(query.sourceMode);
    }
    sql += ` ORDER BY ts ASC`;
    if (query.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(query.limit);
    }
    const { rows } = await getPool().query(sql, params);
    return rows.map(mapTelemetryRow);
  }

  async readLatestN(vehicleId: string, n: number): Promise<TelemetryPoint[]> {
    const { rows } = await getPool().query(
      `SELECT * FROM (
         SELECT * FROM fleet.telemetry_points
         WHERE vehicle_id = $1
         ORDER BY ts DESC
         LIMIT $2
       ) t ORDER BY ts ASC`,
      [vehicleId, n],
    );
    return rows.map(mapTelemetryRow);
  }

  async appendMany(points: TelemetryPoint[]): Promise<void> {
    if (points.length === 0) return;
    // Build a multi-row INSERT; pg driver handles parameterized batches
    const values: unknown[] = [];
    const placeholders = points.map((p, i) => {
      const base = i * 10;
      values.push(
        p.vehicleId,
        p.ts,
        p.lat,
        p.lng,
        p.speedKmh,
        p.heading,
        p.odometerKm,
        p.fuelPct,
        p.engineOn,
        p.sourceMode,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
    });
    await getPool().query(
      `INSERT INTO fleet.telemetry_points
         (vehicle_id, ts, lat, lng, speed_kmh, heading, odometer_km, fuel_pct, engine_on, source_mode)
       VALUES ${placeholders.join(',')}
       ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

function mapTelemetryRow(row: Record<string, unknown>): TelemetryPoint {
  return {
    id: row['id'] as string,
    vehicleId: row['vehicle_id'] as string,
    ts: row['ts'] as Date,
    lat: row['lat'] as number,
    lng: row['lng'] as number,
    speedKmh: row['speed_kmh'] as number,
    heading: row['heading'] as number | undefined,
    odometerKm: row['odometer_km'] as number,
    fuelPct: row['fuel_pct'] as number,
    engineOn: row['engine_on'] as boolean,
    sourceMode: row['source_mode'] as TelemetrySourceMode,
  };
}
