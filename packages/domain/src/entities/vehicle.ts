// Vehicle types and status values

export type VehicleType = 'car' | 'van' | 'truck';

export type VehicleStatus =
  | 'on_trip'
  | 'idle'
  | 'parked'
  | 'off_route'
  | 'alerting'
  | 'maintenance_due';

export interface Vehicle {
  readonly id: string;          // e.g. "V-014"
  readonly vehicleRegNo: string; // e.g. "TS09QJ7744" (Indian format)
  readonly name: string;
  readonly vehicleType: VehicleType;
  readonly depotId: string;
  readonly fuelCapacityL: number;
  readonly initialOdometerKm: number;
  readonly deviceId: string;
  readonly model?: string;
  readonly manufactureYear?: number;
  readonly status: VehicleStatus;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
