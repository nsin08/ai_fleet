export type TelemetrySourceMode = 'replay' | 'live';

export interface TelemetryPoint {
  readonly id: number;
  readonly vehicleId: string;
  readonly vehicleRegNo: string;
  readonly tripId?: string;
  readonly scenarioRunId?: string;
  readonly sourceMode: TelemetrySourceMode;
  readonly sourceEmitterId?: string;
  readonly ts: Date;
  readonly tsEpochMs: number;
  readonly lat: number;
  readonly lng: number;
  readonly speedKph: number;
  readonly ignition: boolean;
  readonly idling: boolean;
  readonly fuelPct: number;
  readonly engineTempC?: number;
  readonly batteryV?: number;
  readonly odometerKm: number;
  readonly headingDeg?: number;
  readonly rpm?: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}
