import { PgAlertRepository, PgEventRepository, PgVehicleRepository } from '@ai-fleet/adapters';
import type { TelemetryPoint, FleetEvent, Alert, EventType, EventSeverity } from '@ai-fleet/domain';
import { WsGateway } from '../../ws/ws-gateway.js';
import { v4 as uuidv4 } from 'uuid';

interface ThresholdRule {
  id: string;
  check: (point: TelemetryPoint) => boolean;
  buildEvent: (point: TelemetryPoint) => Omit<FleetEvent, 'id' | 'createdAt'>;
}

const RULES: ThresholdRule[] = [
  {
    id: 'overspeed',
    check: (p) => p.speedKph > 90,
    buildEvent: (p) => ({
      vehicleId: p.vehicleId,
      vehicleRegNo: p.vehicleRegNo,
      tripId: p.tripId,
      scenarioRunId: p.scenarioRunId,
      sourceMode: p.sourceMode,
      sourceEmitterId: p.sourceEmitterId,
      ts: p.ts,
      eventType: 'OVERSPEED' as EventType,
      severity: (p.speedKph > 110 ? 'HIGH' : 'MEDIUM') as EventSeverity,
      source: 'rule_engine' as const,
      message: `Vehicle ${p.vehicleRegNo} exceeding speed limit: ${p.speedKph} km/h`,
      metadata: { threshold: 90, actual: p.speedKph },
    }),
  },
  {
    id: 'fuel_anomaly',
    check: (p) => p.fuelPct < 10,
    buildEvent: (p) => ({
      vehicleId: p.vehicleId,
      vehicleRegNo: p.vehicleRegNo,
      tripId: p.tripId,
      scenarioRunId: p.scenarioRunId,
      sourceMode: p.sourceMode,
      sourceEmitterId: p.sourceEmitterId,
      ts: p.ts,
      eventType: 'FUEL_ANOMALY' as EventType,
      severity: 'HIGH' as EventSeverity,
      source: 'rule_engine' as const,
      message: `Vehicle ${p.vehicleRegNo} critically low fuel: ${p.fuelPct}%`,
      metadata: { threshold: 10, actual: p.fuelPct },
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
        const event = { id: uuidv4(), ...eventData };
        const [savedEvent] = await eventRepo.appendMany([event]);
        if (gateway && savedEvent) await gateway.publishEvent(savedEvent);

        const now = new Date();
        const alert: Omit<Alert, 'createdAt' | 'updatedAt'> = {
          id: uuidv4(),
          vehicleId: point.vehicleId,
          vehicleRegNo: point.vehicleRegNo,
          tripId: point.tripId,
          scenarioRunId: point.scenarioRunId,
          createdTs: now,
          updatedTs: now,
          alertType: eventData.eventType,
          severity: eventData.severity,
          status: 'OPEN',
          title: `${eventData.eventType} detected`,
          description: eventData.message,
          evidence: eventData.metadata,
          relatedEventIds: [event.id],
        };
        const savedAlert = await alertRepo.createAlert(alert as Alert);
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
