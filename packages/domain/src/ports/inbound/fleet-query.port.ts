import type { Vehicle, VehicleStatus, VehicleType } from '../../entities/vehicle.js';
import type { Driver } from '../../entities/driver.js';
import type { VehicleLatestState, FleetRuntimeState } from '../../entities/fleet-state.js';
import type { FleetMode } from '../../entities/scenario-run.js';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface VehicleListFilters {
  status?: VehicleStatus;
  city?: string;
  depotId?: string;
  vehicleType?: VehicleType;
  driverScoreMin?: number;
  driverScoreMax?: number;
  vehicleRegNo?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface VehicleListItem {
  vehicle: Vehicle;
  driver?: Driver;
  latestState: VehicleLatestState;
}

export interface VehicleListResult {
  items: VehicleListItem[];
  nextCursor?: string;
  total: number;
}

export interface VehicleDetailResult {
  vehicle: Vehicle;
  driver?: Driver;
  latestState: VehicleLatestState;
  /** Rolling telemetry buffer (most recent N points, ordered asc) */
  telemetryBuffer: import('../../entities/telemetry-point.js').TelemetryPoint[];
  /** Most recent events */
  recentEvents: import('../../entities/fleet-event.js').FleetEvent[];
  /** Active trip, if any */
  currentTrip?: import('../../entities/trip.js').Trip;
}

// ---------------------------------------------------------------------------
// Inbound port
// ---------------------------------------------------------------------------

export interface FleetQueryPort {
  listVehicles(filters: VehicleListFilters): Promise<VehicleListResult>;
  getVehicleDetail(
    vehicleId: string,
    opts?: { telemetryWindowMin?: number; eventLimit?: number },
  ): Promise<VehicleDetailResult | null>;
  getFleetMode(): Promise<FleetRuntimeState>;
  setFleetMode(mode: FleetMode): Promise<FleetRuntimeState>;
}
