import type { TelemetryPoint } from '../../entities/telemetry-point.js';

export interface TelemetrySliceQuery {
  vehicleId: string;
  fromTs: Date;
  toTs: Date;
  limit?: number;
}

export interface TelemetryRepositoryPort {
  readSlice(query: TelemetrySliceQuery): Promise<TelemetryPoint[]>;
  readLatestN(vehicleId: string, n: number): Promise<TelemetryPoint[]>;
  appendMany(points: Omit<TelemetryPoint, 'id' | 'tsEpochMs' | 'createdAt'>[]): Promise<TelemetryPoint[]>;
}
