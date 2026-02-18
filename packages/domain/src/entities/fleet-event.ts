export type EventType =
  | 'OVERSPEED'
  | 'HARSH_BRAKE'
  | 'GEOFENCE_BREACH'
  | 'FUEL_ANOMALY'
  | 'DTC_FAULT'
  | 'OFF_ROUTE'
  | 'FATIGUE'
  | 'MAINTENANCE_DUE';

export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type EventSource = 'rule_engine' | 'scenario_script' | 'emitter' | 'manual';

export interface FleetEvent {
  readonly id: string;
  readonly ts: Date;
  readonly vehicleId: string;
  readonly vehicleRegNo: string;
  readonly driverId?: string;
  readonly tripId?: string;
  readonly scenarioRunId?: string;
  readonly sourceMode: 'replay' | 'live';
  readonly sourceEmitterId?: string;
  readonly source: EventSource;
  readonly eventType: EventType;
  readonly severity: EventSeverity;
  readonly message: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}
