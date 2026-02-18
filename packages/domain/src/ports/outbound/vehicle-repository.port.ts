import type { Vehicle, VehicleStatus, VehicleType } from '../../entities/vehicle.js';
import type { VehicleLatestState } from '../../entities/fleet-state.js';

export interface VehicleRepositoryListFilters {
  depotId?: string;
  type?: VehicleType;
  status?: VehicleStatus;
  limit?: number;
  offset?: number;
}

export interface VehicleRepositoryPort {
  findById(vehicleId: string): Promise<Vehicle | null>;
  findByRegNo(regNo: string): Promise<Vehicle | null>;
  list(filters?: VehicleRepositoryListFilters): Promise<Vehicle[]>;
  upsertLatestState(state: VehicleLatestState): Promise<void>;
  getLatestState(vehicleId: string): Promise<VehicleLatestState | null>;
  listLatestStates(vehicleIds?: string[]): Promise<VehicleLatestState[]>;
}
