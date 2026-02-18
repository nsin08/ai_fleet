import type { EventType, EventSeverity } from './fleet-event.js';

export type AlertStatus = 'OPEN' | 'ACK' | 'CLOSED';

export interface Alert {
  readonly id: string;
  readonly createdTs: Date;
  readonly updatedTs: Date;
  readonly closedTs?: Date;
  readonly vehicleId: string;
  readonly vehicleRegNo: string;
  readonly driverId?: string;
  readonly tripId?: string;
  readonly scenarioRunId?: string;
  readonly alertType: EventType;
  readonly severity: EventSeverity;
  readonly status: AlertStatus;
  readonly title: string;
  readonly description: string;
  readonly evidence: Record<string, unknown>;
  readonly relatedEventIds: string[];
  readonly acknowledgedBy?: string;
  readonly acknowledgedTs?: Date;
  readonly note?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
