export type TripStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';

export type StopType = 'traffic' | 'delivery' | 'depot' | 'break' | 'incident';

export interface TripStop {
  readonly id: number;
  readonly tripId: string;
  readonly seq: number;
  readonly stopType: StopType;
  readonly lat: number;
  readonly lng: number;
  readonly arrivedAt: Date;
  readonly departedAt?: Date;
  readonly reason?: string;
}

export interface Trip {
  readonly id: string;
  readonly vehicleId: string;
  readonly driverId: string;
  readonly routeId?: string;
  readonly scenarioRunId?: string;
  readonly status: TripStatus;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly startDepotId?: string;
  readonly endDepotId?: string;
  readonly plannedDistanceKm?: number;
  readonly actualDistanceKm?: number;
  readonly endReason?: string;
  readonly stops: TripStop[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
