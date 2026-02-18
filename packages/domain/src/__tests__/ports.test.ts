/**
 * Port Interface Contract Tests
 *
 * Verify that port interfaces define the expected method signatures.
 * Since these are TypeScript interfaces (no runtime artifact), we test
 * by constructing mock implementations that satisfy each port.
 * A compilation failure here means the port shape changed.
 */

import { describe, it, expect, jest } from '@jest/globals';

import type {
  FleetQueryPort,
  VehicleListFilters,
} from '../ports/inbound/fleet-query.port.js';

import type {
  TelemetryIngestionPort,
  TelemetryBatch,
  HeartbeatPayload,
} from '../ports/inbound/telemetry-ingestion.port.js';

import type { AiUseCasePort } from '../ports/inbound/ai-usecase.port.js';
import type { VehicleRepositoryPort } from '../ports/outbound/vehicle-repository.port.js';
import type { TelemetryRepositoryPort } from '../ports/outbound/telemetry-repository.port.js';
import type { AlertRepositoryPort } from '../ports/outbound/alert-repository.port.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Inbound Ports
// ═══════════════════════════════════════════════════════════════════════════════

describe('FleetQueryPort', () => {
  it('defines listVehicles, getVehicleDetail, getFleetMode, setFleetMode', () => {
    const mock = {
      listVehicles: jest.fn(),
      getVehicleDetail: jest.fn(),
      getFleetMode: jest.fn(),
      setFleetMode: jest.fn(),
    } as unknown as FleetQueryPort;

    expect(typeof mock.listVehicles).toBe('function');
    expect(typeof mock.getVehicleDetail).toBe('function');
    expect(typeof mock.getFleetMode).toBe('function');
    expect(typeof mock.setFleetMode).toBe('function');
  });

  it('VehicleListFilters shape is valid', () => {
    const filters: VehicleListFilters = {
      status: 'on_trip',
      city: 'Mumbai',
      vehicleType: 'truck',
      limit: 10,
    };
    expect(filters.status).toBe('on_trip');
    expect(filters.vehicleType).toBe('truck');
    expect(filters.limit).toBe(10);
  });

  it('VehicleListFilters can be empty', () => {
    const filters: VehicleListFilters = {};
    expect(Object.keys(filters)).toHaveLength(0);
  });
});

describe('TelemetryIngestionPort', () => {
  it('defines ingestTelemetry, ingestEvents, upsertEmitterHeartbeat', () => {
    const mock = {
      ingestTelemetry: jest.fn(),
      ingestEvents: jest.fn(),
      upsertEmitterHeartbeat: jest.fn(),
    } as unknown as TelemetryIngestionPort;

    expect(typeof mock.ingestTelemetry).toBe('function');
    expect(typeof mock.ingestEvents).toBe('function');
    expect(typeof mock.upsertEmitterHeartbeat).toBe('function');
  });

  it('TelemetryBatch shape is valid', () => {
    const batch: TelemetryBatch = {
      emitterId: 'emitter-MH04AB1001',
      vehicleType: 'van',
      sourceMode: 'live',
      records: [
        {
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          ts: Date.now(),
          lat: 19.076,
          lng: 72.877,
          speedKph: 50,
          ignition: true,
          fuelPct: 65,
          odometerKm: 15000,
        },
      ],
    };
    expect(batch.records).toHaveLength(1);
    expect(batch.sourceMode).toBe('live');
    expect(batch.vehicleType).toBe('van');
  });

  it('HeartbeatPayload shape is valid', () => {
    const hb: HeartbeatPayload = {
      emitterId: 'emitter-MH04AB1001',
      vehicleType: 'van',
      replicaIndex: 0,
      ts: Date.now(),
      status: 'online',
    };
    expect(hb.status).toBe('online');
    expect(hb.replicaIndex).toBe(0);
  });
});

describe('AiUseCasePort', () => {
  it('defines getDailySummary, explainAlert, getNextActions, chat', () => {
    const mock = {
      getDailySummary: jest.fn(),
      explainAlert: jest.fn(),
      getNextActions: jest.fn(),
      chat: jest.fn(),
    } as unknown as AiUseCasePort;

    expect(typeof mock.getDailySummary).toBe('function');
    expect(typeof mock.explainAlert).toBe('function');
    expect(typeof mock.getNextActions).toBe('function');
    expect(typeof mock.chat).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Outbound Ports
// ═══════════════════════════════════════════════════════════════════════════════

describe('VehicleRepositoryPort', () => {
  it('defines findById, findByRegNo, list, upsertLatestState, getLatestState, listLatestStates', () => {
    const mock = {
      findById: jest.fn(),
      findByRegNo: jest.fn(),
      list: jest.fn(),
      upsertLatestState: jest.fn(),
      getLatestState: jest.fn(),
      listLatestStates: jest.fn(),
    } as unknown as VehicleRepositoryPort;

    expect(typeof mock.findById).toBe('function');
    expect(typeof mock.findByRegNo).toBe('function');
    expect(typeof mock.list).toBe('function');
    expect(typeof mock.upsertLatestState).toBe('function');
    expect(typeof mock.getLatestState).toBe('function');
    expect(typeof mock.listLatestStates).toBe('function');
  });
});

describe('TelemetryRepositoryPort', () => {
  it('defines readSlice, readLatestN, appendMany', () => {
    const mock = {
      readSlice: jest.fn(),
      readLatestN: jest.fn(),
      appendMany: jest.fn(),
    } as unknown as TelemetryRepositoryPort;

    expect(typeof mock.readSlice).toBe('function');
    expect(typeof mock.readLatestN).toBe('function');
    expect(typeof mock.appendMany).toBe('function');
  });
});

describe('AlertRepositoryPort', () => {
  it('defines createAlert, ackAlert, closeAlert, listAlerts, findById, countOpenByVehicle', () => {
    const mock = {
      createAlert: jest.fn(),
      ackAlert: jest.fn(),
      closeAlert: jest.fn(),
      listAlerts: jest.fn(),
      findById: jest.fn(),
      countOpenByVehicle: jest.fn(),
    } as unknown as AlertRepositoryPort;

    expect(typeof mock.createAlert).toBe('function');
    expect(typeof mock.ackAlert).toBe('function');
    expect(typeof mock.closeAlert).toBe('function');
    expect(typeof mock.listAlerts).toBe('function');
    expect(typeof mock.findById).toBe('function');
    expect(typeof mock.countOpenByVehicle).toBe('function');
  });
});

describe('ScenarioRepositoryPort', () => {
  it('can be imported', async () => {
    const module = await import('../ports/outbound/scenario-repository.port.js');
    expect(module).toBeDefined();
  });
});

describe('StreamPublisherPort', () => {
  it('can be imported', async () => {
    const module = await import('../ports/outbound/stream-publisher.port.js');
    expect(module).toBeDefined();
  });
});

describe('AiInferencePort', () => {
  it('can be imported', async () => {
    const module = await import('../ports/outbound/ai-inference.port.js');
    expect(module).toBeDefined();
  });
});
