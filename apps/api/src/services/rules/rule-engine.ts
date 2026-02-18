import { PgAlertRepository, PgEventRepository, PgVehicleRepository } from '@ai-fleet/adapters';
import type { TelemetryPoint, FleetEvent, Alert } from '@ai-fleet/domain';
import { EventType, EventSeverity, EventSource, AlertStatus } from '@ai-fleet/domain';
import { WsGateway } from '../../ws/ws-gateway.js';
import { v4 as uuidv4 } from 'uuid';

interface ThresholdRule {
  id: string;
  check: (point: TelemetryPoint) => boolean;
  buildEvent: (point: TelemetryPoint) => Omit<FleetEvent, 'id'>;
}

const RULES: ThresholdRule[] = [
  {
    id: 'overspeed',
    check: (p) => p.speedKmh > 90,
    buildEvent: (p) => ({
      vehicleId: p.vehicleId,
      ts: p.ts,
      type: EventType.OVERSPEED,
      severity: p.speedKmh > 110 ? EventSeverity.HIGH : EventSeverity.MEDIUM,
      source: EventSource.RULE_ENGINE,
      value: p.speedKmh,
      meta: { threshold: 90 },
    }),
  },
  {
    id: 'fuel_anomaly',
    check: (p) => p.fuelPct < 10,
    buildEvent: (p) => ({
      vehicleId: p.vehicleId,
      ts: p.ts,
      type: EventType.FUEL_ANOMALY,
      severity: EventSeverity.HIGH,
      source: EventSource.RULE_ENGINE,
      value: p.fuelPct,
      meta: { threshold: 10 },
    }),
  },
];

let _instance: RuleEngine | null = null;

export class RuleEngine {
  static getInstance(): RuleEngine | null {
    return _instance;
  }

  static init(): RuleEngine {
    _instance = new RuleEngine();
    return _instance;
  }

  async evaluate(points: TelemetryPoint[]): Promise<void> {
    const eventRepo = new PgEventRepository();
    const alertRepo = new PgAlertRepository();
    const vehicleRepo = new PgVehicleRepository();
    const gateway = WsGateway.getInstance();

    for (const point of points) {
      for (const rule of RULES) {
        if (!rule.check(point)) continue;

        const eventData = rule.buildEvent(point);
        const event: FleetEvent = { id: uuidv4(), ...eventData };
        await eventRepo.append(event);
        if (gateway) await gateway.publishEvent(event);

        const alert: Alert = {
          id: uuidv4(),
          vehicleId: point.vehicleId,
          ts: point.ts,
          eventType: event.type,
          severity: event.severity,
          message: `${event.type} detected on vehicle ${point.vehicleId}: value=${event.value}`,
          status: AlertStatus.OPEN,
          relatedEventIds: [event.id],
        };
        const savedAlert = await alertRepo.createAlert(alert);
        if (gateway) await gateway.publishAlert(savedAlert);

        // Update open alert count on vehicle state
        const count = await alertRepo.countOpenByVehicle(point.vehicleId);
        const state = await vehicleRepo.getLatestState(point.vehicleId);
        if (state) {
          await vehicleRepo.upsertLatestState({ ...state, activeAlertCount: count });
          if (gateway) await gateway.publishVehicleState({ ...state, activeAlertCount: count });
        }
      }
    }
  }
}
