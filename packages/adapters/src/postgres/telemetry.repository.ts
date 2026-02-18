import type {
  TelemetryRepositoryPort,
  TelemetrySliceQuery,
} from '@ai-fleet/domain';
import type { TelemetryPoint, TelemetrySourceMode } from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgTelemetryRepository implements TelemetryRepositoryPort {
  async readSlice(query: TelemetrySliceQuery): Promise<TelemetryPoint[]> {
    const params: unknown[] = [query.vehicleId, query.fromTs, query.toTs];
    let sql = `
      SELECT * FROM fleet.telemetry_points
      WHERE vehicle_id = $1
        AND ts >= $2
        AND ts <= $3
    `;
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

  async appendMany(points: Omit<TelemetryPoint, 'id' | 'tsEpochMs' | 'createdAt'>[]): Promise<TelemetryPoint[]> {
    if (points.length === 0) return [];
    const values: unknown[] = [];
    const placeholders = points.map((p, i) => {
      const base = i * 19;
      values.push(
        p.vehicleId,
        p.vehicleRegNo,
        p.tripId ?? null,
        p.scenarioRunId ?? null,
        p.sourceMode,
        p.sourceEmitterId ?? null,
        p.ts,
        p.lat,
        p.lng,
        p.speedKph,
        p.ignition,
        p.idling,
        p.fuelPct,
        p.odometerKm,
        p.headingDeg ?? null,
        p.engineTempC ?? null,
        p.batteryV ?? null,
        p.rpm ?? null,
        JSON.stringify(p.metadata ?? {}),
      );
      // 19 cols per row
      const cols = Array.from({ length: 19 }, (_, k) => `$${base + k + 1}`);
      return `(${cols.join(',')})`;
    });
    const { rows } = await getPool().query(
      `INSERT INTO fleet.telemetry_points
         (vehicle_id, vehicle_reg_no, trip_id, scenario_run_id, source_mode, source_emitter_id,
          ts, lat, lng, speed_kph, ignition, idling, fuel_pct, odometer_km,
          heading_deg, engine_temp_c, battery_v, rpm, metadata)
       VALUES ${placeholders.join(',')}
       ON CONFLICT DO NOTHING
       RETURNING *`,
      values,
    );
    return rows.map(mapTelemetryRow);
  }
}

function mapTelemetryRow(row: Record<string, unknown>): TelemetryPoint {
  return {
    id: row['id'] as number,
    vehicleId: row['vehicle_id'] as string,
    vehicleRegNo: row['vehicle_reg_no'] as string,
    tripId: row['trip_id'] as string | undefined,
    scenarioRunId: row['scenario_run_id'] as string | undefined,
    sourceMode: row['source_mode'] as TelemetrySourceMode,
    sourceEmitterId: row['source_emitter_id'] as string | undefined,
    ts: row['ts'] as Date,
    tsEpochMs: row['ts_epoch_ms'] as number,
    lat: row['lat'] as number,
    lng: row['lng'] as number,
    speedKph: row['speed_kph'] as number,
    ignition: row['ignition'] as boolean,
    idling: row['idling'] as boolean,
    fuelPct: row['fuel_pct'] as number,
    engineTempC: row['engine_temp_c'] as number | undefined,
    batteryV: row['battery_v'] as number | undefined,
    odometerKm: row['odometer_km'] as number,
    headingDeg: row['heading_deg'] as number | undefined,
    rpm: row['rpm'] as number | undefined,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: row['created_at'] as Date,
  };
}

