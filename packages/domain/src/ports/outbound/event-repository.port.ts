import type { FleetEvent, EventType, EventSeverity } from '../../entities/fleet-event.js';

export interface EventListFilters {
  vehicleId?: string;
  eventType?: EventType;
  severity?: EventSeverity;
  fromTs?: Date;
  toTs?: Date;
  limit?: number;
  offset?: number;
}

export interface EventRepositoryPort {
  append(event: Omit<FleetEvent, 'createdAt'>): Promise<FleetEvent>;
  appendMany(events: Omit<FleetEvent, 'createdAt'>[]): Promise<FleetEvent[]>;
  listEvents(filters: EventListFilters): Promise<FleetEvent[]>;
  findById(id: string): Promise<FleetEvent | null>;
}
