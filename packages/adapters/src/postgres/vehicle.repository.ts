import type {
  VehicleRepositoryPort,
  VehicleListFilters,
} from '@ai-fleet/domain';
import type { Vehicle, VehicleStatus, VehicleType } from '@ai-fleet/domain';
import type { VehicleLatestState } from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgVehicleRepository implements VehicleRepositoryPort {
  async findById(vehicleId: string): Promise<Vehicle | null> {
    const { rows } = await getPool().query<Vehicle>(
      `SELECT * FROM fleet.vehicles WHERE id = $1`,
      [vehicleId],
    );
    return rows[0] ?? null;
  }

  async findByRegNo(regNo: string): Promise<Vehicle | null> {
    const { rows } = await getPool().query<Vehicle>(
      `SELECT * FROM fleet.vehicles WHERE reg_no = $1`,
      [regNo],
    );
    return rows[0] ?? null;
  }

  async list(filters: VehicleListFilters = {}): Promise<Vehicle[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.depotId) {
      conditions.push(`depot_id = $${idx++}`);
      params.push(filters.depotId);
    }
    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      params.push(filters.type);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const { rows } = await getPool().query<Vehicle>(
      `SELECT * FROM fleet.vehicles ${where} ORDER BY reg_no LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return rows;
  }

  async upsertLatestState(state: VehicleLatestState): Promise<void> {
    await getPool().query(
      `INSERT INTO fleet.vehicle_latest_state
        (vehicle_id, ts, lat, lng, speed_kmh, heading, odometer_km,
         fuel_pct, engine_on, idling, status, active_alert_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (vehicle_id) DO UPDATE SET
         ts = EXCLUDED.ts,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         speed_kmh = EXCLUDED.speed_kmh,
         heading = EXCLUDED.heading,
         odometer_km = EXCLUDED.odometer_km,
         fuel_pct = EXCLUDED.fuel_pct,
         engine_on = EXCLUDED.engine_on,
         idling = EXCLUDED.idling,
         status = EXCLUDED.status,
         active_alert_count = EXCLUDED.active_alert_count,
         updated_at = NOW()`,
      [
        state.vehicleId,
        state.ts,
        state.lat,
        state.lng,
        state.speedKmh,
        state.heading,
        state.odometerKm,
        state.fuelPct,
        state.engineOn,
        state.idling,
        state.status,
        state.activeAlertCount,
      ],
    );
  }

  async getLatestState(vehicleId: string): Promise<VehicleLatestState | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.vehicle_latest_state WHERE vehicle_id = $1`,
      [vehicleId],
    );
    return rows[0] ? mapLatestState(rows[0]) : null;
  }

  async listLatestStates(vehicleIds?: string[]): Promise<VehicleLatestState[]> {
    if (vehicleIds && vehicleIds.length === 0) return [];
    const { rows } = vehicleIds
      ? await getPool().query(
          `SELECT * FROM fleet.vehicle_latest_state WHERE vehicle_id = ANY($1)`,
          [vehicleIds],
        )
      : await getPool().query(`SELECT * FROM fleet.vehicle_latest_state`);
    return rows.map(mapLatestState);
  }
}

function mapLatestState(row: Record<string, unknown>): VehicleLatestState {
  return {
    vehicleId: row['vehicle_id'] as string,
    ts: row['ts'] as Date,
    lat: row['lat'] as number,
    lng: row['lng'] as number,
    speedKmh: row['speed_kmh'] as number,
    heading: row['heading'] as number | undefined,
    odometerKm: row['odometer_km'] as number,
    fuelPct: row['fuel_pct'] as number,
    engineOn: row['engine_on'] as boolean,
    idling: row['idling'] as boolean,
    status: row['status'] as VehicleStatus,
    activeAlertCount: row['active_alert_count'] as number,
  };
}
