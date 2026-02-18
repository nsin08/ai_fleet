import type {
  VehicleRepositoryPort,
  VehicleRepositoryListFilters,
} from '@ai-fleet/domain';
import type { Vehicle, VehicleStatus, VehicleType } from '@ai-fleet/domain';
import type { VehicleLatestState } from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgVehicleRepository implements VehicleRepositoryPort {
  async findById(vehicleId: string): Promise<Vehicle | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.vehicles WHERE id = $1`,
      [vehicleId],
    );
    return rows[0] ? mapVehicle(rows[0]) : null;
  }

  async findByRegNo(regNo: string): Promise<Vehicle | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.vehicles WHERE vehicle_reg_no = $1`,
      [regNo],
    );
    return rows[0] ? mapVehicle(rows[0]) : null;
  }

  async list(filters: VehicleRepositoryListFilters = {}): Promise<Vehicle[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.depotId) {
      conditions.push(`depot_id = $${idx++}`);
      params.push(filters.depotId);
    }
    if (filters.type) {
      conditions.push(`vehicle_type = $${idx++}`);
      params.push(filters.type);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const { rows } = await getPool().query(
      `SELECT * FROM fleet.vehicles ${where} ORDER BY vehicle_reg_no LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return rows.map(mapVehicle);
  }

  async upsertLatestState(state: VehicleLatestState): Promise<void> {
    await getPool().query(
      `INSERT INTO fleet.vehicle_latest_state
        (vehicle_id, vehicle_reg_no, last_ts, lat, lng, speed_kph, heading_deg, odometer_km,
         fuel_pct, ignition, idling, status, active_alert_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (vehicle_id) DO UPDATE SET
         vehicle_reg_no   = EXCLUDED.vehicle_reg_no,
         last_ts          = EXCLUDED.last_ts,
         lat              = EXCLUDED.lat,
         lng              = EXCLUDED.lng,
         speed_kph        = EXCLUDED.speed_kph,
         heading_deg      = EXCLUDED.heading_deg,
         odometer_km      = EXCLUDED.odometer_km,
         fuel_pct         = EXCLUDED.fuel_pct,
         ignition         = EXCLUDED.ignition,
         idling           = EXCLUDED.idling,
         status           = EXCLUDED.status,
         active_alert_count = EXCLUDED.active_alert_count,
         updated_at       = NOW()`,
      [
        state.vehicleId,
        state.vehicleRegNo,
        state.lastTs,
        state.lat,
        state.lng,
        state.speedKph,
        state.headingDeg,
        state.odometerKm,
        state.fuelPct,
        state.ignition,
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
    vehicleRegNo: row['vehicle_reg_no'] as string,
    driverId: row['driver_id'] as string | undefined,
    tripId: row['trip_id'] as string | undefined,
    status: row['status'] as VehicleStatus,
    lastTelemetryId: row['last_telemetry_id'] as number | undefined,
    lastTs: row['last_ts'] as Date | undefined,
    lat: row['lat'] as number | undefined,
    lng: row['lng'] as number | undefined,
    speedKph: row['speed_kph'] as number | undefined,
    ignition: row['ignition'] as boolean | undefined,
    idling: row['idling'] as boolean | undefined,
    fuelPct: row['fuel_pct'] as number | undefined,
    engineTempC: row['engine_temp_c'] as number | undefined,
    batteryV: row['battery_v'] as number | undefined,
    odometerKm: row['odometer_km'] as number | undefined,
    headingDeg: row['heading_deg'] as number | undefined,
    activeAlertCount: (row['active_alert_count'] as number) ?? 0,
    maintenanceDue: (row['maintenance_due'] as boolean) ?? false,
    updatedAt: row['updated_at'] as Date,
  };
}

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: row['id'] as string,
    vehicleRegNo: row['vehicle_reg_no'] as string,
    name: row['name'] as string,
    vehicleType: row['vehicle_type'] as VehicleType,
    depotId: row['depot_id'] as string,
    fuelCapacityL: row['fuel_capacity_l'] as number,
    initialOdometerKm: row['initial_odometer_km'] as number,
    deviceId: row['device_id'] as string,
    model: row['model'] as string | undefined,
    manufactureYear: row['manufacture_year'] as number | undefined,
    status: row['status'] as VehicleStatus,
    isActive: row['is_active'] as boolean,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}
