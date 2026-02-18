/* Shared TypeScript interfaces matching the API response shapes */

export interface Vehicle {
  id: string;
  vehicleRegNo: string;
  name: string;
  vehicleType: string;
  depotId: string;
  status: string;
  isActive: boolean;
  assignedDriverId?: string;
}

export interface VehicleDetail extends Vehicle {
  latestTelemetry?: TelemetryPoint[];
  openAlerts?: Alert[];
  recentEvents?: FleetEvent[];
}

export interface TelemetryPoint {
  id: number;
  vehicleId: string;
  vehicleRegNo: string;
  tripId?: string;
  scenarioRunId?: string;
  sourceMode: 'replay' | 'live';
  sourceEmitterId?: string;
  ts: string;
  tsEpochMs: number;
  lat: number;
  lng: number;
  speedKph: number;
  ignition: boolean;
  idling: boolean;
  fuelPct: number;
  engineTempC?: number;
  batteryV?: number;
  odometerKm: number;
  headingDeg?: number;
  rpm?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FleetEvent {
  id: string;
  ts: string;
  vehicleId: string;
  vehicleRegNo: string;
  driverId?: string;
  tripId?: string;
  scenarioRunId?: string;
  sourceMode: 'replay' | 'live';
  sourceEmitterId?: string;
  source: string;
  eventType: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Alert {
  id: string;
  createdTs: string;
  updatedTs: string;
  closedTs?: string;
  vehicleId: string;
  vehicleRegNo: string;
  driverId?: string;
  tripId?: string;
  scenarioRunId?: string;
  alertType: string;
  severity: string;
  status: 'OPEN' | 'ACK' | 'CLOSED';
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  relatedEventIds?: string[];
  acknowledgedBy?: string;
  acknowledgedTs?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleetMode {
  mode: 'replay' | 'live';
  active_run_id: string | null;
  updated_at?: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description?: string;
  timelineSec: number;
  steps: ScenarioStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  scenarioId: string;
  stepNo: number;
  atSec: number;
  action: string;
  data: Record<string, unknown>;
}

export interface ScenarioRun {
  id: string;
  scenarioId?: string;
  mode: 'replay' | 'live';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'RESET' | 'FAILED';
  seed?: number;
  speedFactor: number;
  startedAt: string;
  endedAt?: string;
  cursorTs?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
