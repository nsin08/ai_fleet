export interface RoutePoint {
  readonly seq: number;
  readonly lat: number;
  readonly lng: number;
}

export interface Route {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly depotId?: string;
  readonly routeKind: string;   // 'loop' | 'one_way' | etc.
  readonly distanceKm?: number;
  readonly estimatedDurationSec?: number;
  readonly points: RoutePoint[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
