export interface Depot {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly stateCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type GeofenceType = 'circle' | 'polygon';

export interface Geofence {
  readonly id: string;
  readonly name: string;
  readonly fenceType: GeofenceType;
  readonly depotId?: string;
  readonly city?: string;
  // circle fields
  readonly centerLat?: number;
  readonly centerLng?: number;
  readonly radiusKm?: number;
  // polygon fields
  readonly polygonGeoJson?: unknown;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
