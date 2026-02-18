import type { TelemetrySourceMode } from '../entities/telemetry-point.js';
import type { EventType, EventSeverity } from '../entities/fleet-event.js';
import type { VehicleType } from '../entities/vehicle.js';

// ---------------------------------------------------------------------------
// Inbound telemetry record (from emitter or replay engine)
// ---------------------------------------------------------------------------

export interface TelemetryRecord {
  vehicleId: string;
  vehicleRegNo: string;
  ts: number; // epoch ms
  lat: number;
  lng: number;
  speedKph: number;
  ignition: boolean;
  fuelPct: number;
  engineTempC?: number;
  batteryV?: number;
  odometerKm: number;
  headingDeg?: number;
  rpm?: number;
}

export interface TelemetryBatch {
  emitterId: string;
  vehicleType: VehicleType;
  sourceMode: TelemetrySourceMode;
  records: TelemetryRecord[];
}

export interface TelemetryIngestResult {
  accepted: number;
  rejected: number;
  errors: Array<{ index: number; reason: string }>;
}

// ---------------------------------------------------------------------------
// Inbound event record
// ---------------------------------------------------------------------------

export interface EventRecord {
  vehicleId: string;
  vehicleRegNo: string;
  ts: number; // epoch ms
  type: EventType;
  severity: EventSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EventBatch {
  emitterId: string;
  sourceMode: TelemetrySourceMode;
  records: EventRecord[];
}

export interface EventIngestResult {
  accepted: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Emitter heartbeat
// ---------------------------------------------------------------------------

export interface HeartbeatPayload {
  emitterId: string;
  vehicleType: VehicleType;
  replicaIndex: number;
  ts: number; // epoch ms
  status: 'online' | 'offline' | 'degraded';
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface TelemetryIngestionPort {
  ingestTelemetry(batch: TelemetryBatch): Promise<TelemetryIngestResult>;
  ingestEvents(batch: EventBatch): Promise<EventIngestResult>;
  upsertEmitterHeartbeat(payload: HeartbeatPayload): Promise<void>;
}
