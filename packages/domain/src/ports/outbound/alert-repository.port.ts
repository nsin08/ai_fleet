import type { Alert, AlertStatus } from '../../entities/alert.js';
import type { EventType, EventSeverity } from '../../entities/fleet-event.js';

export interface AlertListFilters {
  vehicleId?: string;
  vehicleRegNo?: string;
  alertType?: EventType;
  severity?: EventSeverity;
  status?: AlertStatus;
  fromTs?: Date;
  toTs?: Date;
  limit?: number;
  offset?: number;
}

export interface AckAlertCommand {
  alertId: string;
  actorId?: string;
  note?: string;
}

export interface AlertRepositoryPort {
  createAlert(alert: Omit<Alert, 'createdAt' | 'updatedAt' | 'createdTs' | 'updatedTs'>): Promise<Alert>;
  ackAlert(cmd: AckAlertCommand): Promise<Alert>;
  closeAlert(alertId: string): Promise<Alert>;
  listAlerts(filters: AlertListFilters): Promise<Alert[]>;
  findById(id: string): Promise<Alert | null>;
  countOpenByVehicle(vehicleId: string): Promise<number>;
}
