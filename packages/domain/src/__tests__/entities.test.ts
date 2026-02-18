/**
 * Domain Entity Type-Contract Tests
 *
 * The domain package exports pure interfaces and string-literal union types.
 * These tests verify:
 *   1. Every entity can be constructed with valid data
 *   2. Type unions contain the expected members
 *   3. Required vs optional fields behave correctly
 *   4. Invariants (value ranges, format expectations) are documented
 */

import { describe, it, expect } from '@jest/globals';

import type {
  Vehicle,
  VehicleType,
  VehicleStatus,
  Driver,
  Depot,
  GeofenceType,
  Geofence,
  Route,
  RoutePoint,
  Trip,
  TripStatus,
  StopType,
  TripStop,
  TelemetryPoint,
  TelemetrySourceMode,
  FleetEvent,
  EventType,
  EventSeverity,
  EventSource,
  Alert,
  AlertStatus,
  ScenarioRun,
  ScenarioRunStatus,
  ScenarioDefinition,
  ScenarioDefinitionStep,
  FleetMode,
  VehicleLatestState,
  FleetRuntimeState,
  EmitterHeartbeat,
} from '../index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date();

function expectType<T>(_val: T): void {
  /* compile-time assertion */
}

// ─── Factory helpers to build valid entities ──────────────────────────────────

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-mum-01',
    vehicleRegNo: 'MH04AB1001',
    name: 'Fleet Van 1',
    vehicleType: 'van',
    depotId: 'depot-mum-01',
    fuelCapacityL: 60,
    initialOdometerKm: 15000,
    deviceId: 'dev-001',
    status: 'idle',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'drv-001',
    name: 'Test Driver',
    licenseId: 'LIC-12345',
    baseSafetyScore: 85,
    currentSafetyScore: 82,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDepot(overrides: Partial<Depot> = {}): Depot {
  return {
    id: 'depot-mum-01',
    name: 'Mumbai Depot',
    city: 'Mumbai',
    stateCode: 'MH',
    lat: 19.076,
    lng: 72.8777,
    radiusKm: 1.5,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTelemetryPoint(overrides: Partial<TelemetryPoint> = {}): TelemetryPoint {
  return {
    id: 1,
    vehicleId: 'veh-mum-01',
    vehicleRegNo: 'MH04AB1001',
    sourceMode: 'live',
    ts: NOW,
    tsEpochMs: NOW.getTime(),
    lat: 19.076,
    lng: 72.8777,
    speedKph: 45,
    ignition: true,
    idling: false,
    fuelPct: 72.5,
    odometerKm: 15042,
    metadata: {},
    createdAt: NOW,
    ...overrides,
  };
}

function makeFleetEvent(overrides: Partial<FleetEvent> = {}): FleetEvent {
  return {
    id: 'evt-001',
    ts: NOW,
    vehicleId: 'veh-mum-01',
    vehicleRegNo: 'MH04AB1001',
    sourceMode: 'replay',
    source: 'rule_engine',
    eventType: 'OVERSPEED',
    severity: 'HIGH',
    message: 'Vehicle exceeded 80 kph in urban zone',
    metadata: {},
    createdAt: NOW,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-001',
    createdTs: NOW,
    updatedTs: NOW,
    vehicleId: 'veh-mum-01',
    vehicleRegNo: 'MH04AB1001',
    alertType: 'OVERSPEED',
    severity: 'HIGH',
    status: 'OPEN',
    title: 'Overspeed Alert',
    description: 'Vehicle exceeded speed limit',
    evidence: { speedKph: 95, limit: 80 },
    relatedEventIds: ['evt-001'],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeScenarioRun(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    id: 'run-001',
    scenarioId: 'scenario-mixed-alert',
    mode: 'replay',
    status: 'RUNNING',
    speedFactor: 1,
    startedAt: NOW,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vehicle entity', () => {
  it('constructs with all required fields', () => {
    const v = makeVehicle();
    expect(v.id).toBe('veh-mum-01');
    expect(v.vehicleRegNo).toBe('MH04AB1001');
    expect(v.vehicleType).toBe('van');
    expect(v.status).toBe('idle');
    expect(v.isActive).toBe(true);
    expect(v.fuelCapacityL).toBe(60);
  });

  it('accepts optional fields (model, manufactureYear)', () => {
    const v = makeVehicle({ model: 'Tata Ace', manufactureYear: 2022 });
    expect(v.model).toBe('Tata Ace');
    expect(v.manufactureYear).toBe(2022);
  });

  it('VehicleType union covers expected values', () => {
    const types: VehicleType[] = ['car', 'van', 'truck'];
    expect(types).toHaveLength(3);
    types.forEach((t) => expect(typeof t).toBe('string'));
  });

  it('VehicleStatus union covers expected values', () => {
    const statuses: VehicleStatus[] = [
      'on_trip',
      'idle',
      'parked',
      'off_route',
      'alerting',
      'maintenance_due',
    ];
    expect(statuses).toHaveLength(6);
  });
});

describe('Driver entity', () => {
  it('constructs with valid data', () => {
    const d = makeDriver();
    expect(d.name).toBe('Test Driver');
    expect(d.baseSafetyScore).toBe(85);
    expect(d.currentSafetyScore).toBe(82);
  });

  it('safety scores are numbers between 0 and 100', () => {
    const d = makeDriver({ baseSafetyScore: 0, currentSafetyScore: 100 });
    expect(d.baseSafetyScore).toBeGreaterThanOrEqual(0);
    expect(d.currentSafetyScore).toBeLessThanOrEqual(100);
  });

  it('phone is optional', () => {
    const withPhone = makeDriver({ phone: '+91-9876543210' });
    const noPhone = makeDriver();
    expect(withPhone.phone).toBe('+91-9876543210');
    expect(noPhone.phone).toBeUndefined();
  });
});

describe('Depot entity', () => {
  it('constructs with coordinate fields', () => {
    const d = makeDepot();
    expect(d.lat).toBeCloseTo(19.076, 2);
    expect(d.lng).toBeCloseTo(72.8777, 2);
    expect(d.radiusKm).toBe(1.5);
  });
});

describe('TelemetryPoint entity', () => {
  it('constructs with all required fields', () => {
    const tp = makeTelemetryPoint();
    expect(tp.vehicleId).toBe('veh-mum-01');
    expect(tp.sourceMode).toBe('live');
    expect(tp.lat).toBeCloseTo(19.076, 2);
    expect(tp.speedKph).toBe(45);
    expect(tp.ignition).toBe(true);
    expect(tp.idling).toBe(false);
    expect(tp.fuelPct).toBe(72.5);
  });

  it('optional fields default to undefined', () => {
    const tp = makeTelemetryPoint();
    expect(tp.tripId).toBeUndefined();
    expect(tp.scenarioRunId).toBeUndefined();
    expect(tp.sourceEmitterId).toBeUndefined();
    expect(tp.engineTempC).toBeUndefined();
    expect(tp.batteryV).toBeUndefined();
    expect(tp.headingDeg).toBeUndefined();
    expect(tp.rpm).toBeUndefined();
  });

  it('accepts optional fields when provided', () => {
    const tp = makeTelemetryPoint({
      tripId: 'trip-001',
      scenarioRunId: 'run-001',
      sourceEmitterId: 'emitter-MH04AB1001',
      engineTempC: 92,
      batteryV: 12.6,
      headingDeg: 180,
      rpm: 2500,
    });
    expect(tp.engineTempC).toBe(92);
    expect(tp.headingDeg).toBe(180);
    expect(tp.rpm).toBe(2500);
  });

  it('TelemetrySourceMode union covers expected values', () => {
    const modes: TelemetrySourceMode[] = ['replay', 'live'];
    expect(modes).toHaveLength(2);
  });

  it('tsEpochMs matches ts', () => {
    const tp = makeTelemetryPoint();
    expect(tp.tsEpochMs).toBe(tp.ts.getTime());
  });
});

describe('FleetEvent entity', () => {
  it('constructs with all required fields', () => {
    const e = makeFleetEvent();
    expect(e.eventType).toBe('OVERSPEED');
    expect(e.severity).toBe('HIGH');
    expect(e.source).toBe('rule_engine');
    expect(e.message).toContain('exceeded');
  });

  it('EventType union covers all expected values', () => {
    const types: EventType[] = [
      'OVERSPEED',
      'HARSH_BRAKE',
      'GEOFENCE_BREACH',
      'FUEL_ANOMALY',
      'DTC_FAULT',
      'OFF_ROUTE',
      'FATIGUE',
      'MAINTENANCE_DUE',
    ];
    expect(types).toHaveLength(8);
  });

  it('EventSeverity union covers expected values', () => {
    const sevs: EventSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(sevs).toHaveLength(3);
  });

  it('EventSource union covers expected values', () => {
    const sources: EventSource[] = ['rule_engine', 'scenario_script', 'emitter', 'manual'];
    expect(sources).toHaveLength(4);
  });

  it('optional fields are undefined when not provided', () => {
    const e = makeFleetEvent();
    expect(e.driverId).toBeUndefined();
    expect(e.tripId).toBeUndefined();
    expect(e.scenarioRunId).toBeUndefined();
    expect(e.sourceEmitterId).toBeUndefined();
  });
});

describe('Alert entity', () => {
  it('constructs with all required fields', () => {
    const a = makeAlert();
    expect(a.alertType).toBe('OVERSPEED');
    expect(a.status).toBe('OPEN');
    expect(a.title).toBe('Overspeed Alert');
    expect(a.evidence).toEqual({ speedKph: 95, limit: 80 });
    expect(a.relatedEventIds).toEqual(['evt-001']);
  });

  it('AlertStatus union covers expected values', () => {
    const statuses: AlertStatus[] = ['OPEN', 'ACK', 'CLOSED'];
    expect(statuses).toHaveLength(3);
  });

  it('acknowledgedBy/acknowledgedTs/note are optional', () => {
    const a = makeAlert();
    expect(a.acknowledgedBy).toBeUndefined();
    expect(a.acknowledgedTs).toBeUndefined();
    expect(a.note).toBeUndefined();
  });

  it('closedTs is optional', () => {
    const open = makeAlert();
    const closed = makeAlert({ closedTs: NOW, status: 'CLOSED' });
    expect(open.closedTs).toBeUndefined();
    expect(closed.closedTs).toBe(NOW);
    expect(closed.status).toBe('CLOSED');
  });

  it('acknowledged alert has actor and timestamp', () => {
    const ack = makeAlert({
      status: 'ACK',
      acknowledgedBy: 'operator-01',
      acknowledgedTs: NOW,
      note: 'Checking with driver',
    });
    expect(ack.status).toBe('ACK');
    expect(ack.acknowledgedBy).toBe('operator-01');
    expect(ack.note).toBe('Checking with driver');
  });
});

describe('ScenarioRun entity', () => {
  it('constructs with all required fields', () => {
    const r = makeScenarioRun();
    expect(r.mode).toBe('replay');
    expect(r.status).toBe('RUNNING');
    expect(r.speedFactor).toBe(1);
  });

  it('ScenarioRunStatus union covers expected values', () => {
    const statuses: ScenarioRunStatus[] = ['RUNNING', 'PAUSED', 'COMPLETED', 'RESET', 'FAILED'];
    expect(statuses).toHaveLength(5);
  });

  it('FleetMode union covers expected values', () => {
    const modes: FleetMode[] = ['replay', 'live'];
    expect(modes).toHaveLength(2);
  });

  it('optional fields are undefined when not provided', () => {
    const r = makeScenarioRun();
    expect(r.seed).toBeUndefined();
    expect(r.endedAt).toBeUndefined();
    expect(r.cursorTs).toBeUndefined();
  });
});

describe('VehicleLatestState entity', () => {
  it('constructs with required fields', () => {
    const s: VehicleLatestState = {
      vehicleId: 'veh-mum-01',
      vehicleRegNo: 'MH04AB1001',
      status: 'on_trip',
      activeAlertCount: 2,
      maintenanceDue: false,
      updatedAt: NOW,
    };
    expect(s.vehicleId).toBe('veh-mum-01');
    expect(s.activeAlertCount).toBe(2);
    expect(s.maintenanceDue).toBe(false);
  });

  it('optional telemetry fields can be populated', () => {
    const s: VehicleLatestState = {
      vehicleId: 'veh-mum-01',
      vehicleRegNo: 'MH04AB1001',
      status: 'on_trip',
      activeAlertCount: 0,
      maintenanceDue: false,
      updatedAt: NOW,
      lastTelemetryId: 1234,
      lastTs: NOW,
      lat: 19.076,
      lng: 72.8777,
      speedKph: 60,
      ignition: true,
      idling: false,
      fuelPct: 70,
      engineTempC: 90,
      batteryV: 12.4,
      odometerKm: 15100,
      headingDeg: 270,
    };
    expect(s.speedKph).toBe(60);
    expect(s.headingDeg).toBe(270);
  });
});

describe('FleetRuntimeState entity', () => {
  it('constructs with required fields', () => {
    const s: FleetRuntimeState = {
      currentMode: 'replay',
      updatedAt: NOW,
    };
    expect(s.currentMode).toBe('replay');
    expect(s.activeScenarioRunId).toBeUndefined();
  });

  it('can include active scenario run', () => {
    const s: FleetRuntimeState = {
      currentMode: 'replay',
      activeScenarioRunId: 'run-001',
      updatedAt: NOW,
    };
    expect(s.activeScenarioRunId).toBe('run-001');
  });
});

describe('EmitterHeartbeat entity', () => {
  it('constructs with required fields', () => {
    const hb: EmitterHeartbeat = {
      emitterId: 'emitter-MH04AB1001',
      vehicleType: 'van',
      replicaIndex: 0,
      status: 'online',
      lastSeenTs: NOW,
      metadata: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(hb.emitterId).toBe('emitter-MH04AB1001');
    expect(hb.status).toBe('online');
    expect(hb.vehicleType).toBe('van');
  });

  it('status can be online, offline, or degraded', () => {
    const statuses: EmitterHeartbeat['status'][] = ['online', 'offline', 'degraded'];
    expect(statuses).toHaveLength(3);
  });
});

describe('Route entity', () => {
  it('constructs with points', () => {
    const r: Route = {
      id: 'route-01',
      name: 'Mumbai Loop',
      city: 'Mumbai',
      routeKind: 'loop',
      points: [
        { seq: 1, lat: 19.076, lng: 72.8777 },
        { seq: 2, lat: 19.08, lng: 72.88 },
      ],
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(r.points).toHaveLength(2);
    expect(r.points[0]!.seq).toBe(1);
    expect(r.routeKind).toBe('loop');
  });
});

describe('Trip entity', () => {
  it('constructs with required fields', () => {
    const t: Trip = {
      id: 'trip-001',
      vehicleId: 'veh-mum-01',
      driverId: 'drv-001',
      status: 'active',
      startedAt: NOW,
      stops: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(t.status).toBe('active');
    expect(t.stops).toHaveLength(0);
  });

  it('TripStatus union covers expected values', () => {
    const statuses: TripStatus[] = ['planned', 'active', 'paused', 'completed', 'cancelled'];
    expect(statuses).toHaveLength(5);
  });

  it('StopType union covers expected values', () => {
    const types: StopType[] = ['traffic', 'delivery', 'depot', 'break', 'incident'];
    expect(types).toHaveLength(5);
  });

  it('trip with stops', () => {
    const stop: TripStop = {
      id: 1,
      tripId: 'trip-001',
      seq: 1,
      stopType: 'delivery',
      lat: 19.08,
      lng: 72.88,
      arrivedAt: NOW,
    };
    const t: Trip = {
      id: 'trip-001',
      vehicleId: 'veh-mum-01',
      driverId: 'drv-001',
      status: 'active',
      startedAt: NOW,
      stops: [stop],
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(t.stops).toHaveLength(1);
    expect(t.stops[0]!.stopType).toBe('delivery');
  });
});

describe('Geofence entity', () => {
  it('circle geofence', () => {
    const g: Geofence = {
      id: 'geo-01',
      name: 'Mumbai Hub',
      fenceType: 'circle',
      centerLat: 19.076,
      centerLng: 72.8777,
      radiusKm: 2,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(g.fenceType).toBe('circle');
    expect(g.radiusKm).toBe(2);
  });

  it('polygon geofence', () => {
    const g: Geofence = {
      id: 'geo-02',
      name: 'Restricted Zone',
      fenceType: 'polygon',
      polygonGeoJson: { type: 'Polygon', coordinates: [[[72.8, 19.0], [72.9, 19.0], [72.9, 19.1], [72.8, 19.1]]] },
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(g.fenceType).toBe('polygon');
    expect(g.polygonGeoJson).toBeDefined();
  });

  it('GeofenceType union covers expected values', () => {
    const types: GeofenceType[] = ['circle', 'polygon'];
    expect(types).toHaveLength(2);
  });
});

describe('Module exports', () => {
  it('all entity types are exported from index', async () => {
    // Dynamic import to verify the barrel file works
    const domain = await import('../index.js');
    // The index file re-exports everything; if it compiles, exports are valid.
    // We verify a few runtime-accessible things:
    expect(domain).toBeDefined();
  });
});
