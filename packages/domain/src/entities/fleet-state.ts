import type { VehicleType } from './vehicle.js';
import type { VehicleStatus } from './vehicle.js';

/** Denormalized projection updated by the rule engine after every telemetry UPSERT */
export interface VehicleLatestState {
  readonly vehicleId: string;
  readonly vehicleRegNo: string;
  readonly driverId?: string;
  readonly tripId?: string;
  readonly status: VehicleStatus;
  readonly lastTelemetryId?: number;
  readonly lastTs?: Date;
  readonly lat?: number;
  readonly lng?: number;
  readonly speedKph?: number;
  readonly ignition?: boolean;
  readonly idling?: boolean;
  readonly fuelPct?: number;
  readonly engineTempC?: number;
  readonly batteryV?: number;
  readonly odometerKm?: number;
  readonly headingDeg?: number;
  readonly activeAlertCount: number;
  readonly maintenanceDue: boolean;
  readonly updatedAt: Date;
}

/** Singleton row tracking current fleet operational mode */
export interface FleetRuntimeState {
  readonly currentMode: 'replay' | 'live';
  readonly activeScenarioRunId?: string;
  readonly updatedAt: Date;
}

/** Heartbeat from a live vehicle emitter container */
export interface EmitterHeartbeat {
  readonly emitterId: string;
  readonly vehicleType: VehicleType;
  readonly replicaIndex: number;
  readonly status: 'online' | 'offline' | 'degraded';
  readonly lastSeenTs: Date;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
