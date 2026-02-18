/**
 * API Controller Tests
 *
 * Tests Express routes by mocking `@ai-fleet/adapters` and using supertest.
 * Each test constructs the Express app, injects requests, and verifies responses.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// ─── Mock @ai-fleet/adapters before any imports that use it ───────────────────

const mockQuery = jest.fn<AnyFn>();
const mockGetPool = jest.fn<AnyFn>().mockReturnValue({ query: mockQuery });

const mockVehicleRepo = {
  list: jest.fn<AnyFn>(),
  findById: jest.fn<AnyFn>(),
  findByRegNo: jest.fn<AnyFn>(),
  getLatestState: jest.fn<AnyFn>(),
  listLatestStates: jest.fn<AnyFn>(),
  upsertLatestState: jest.fn<AnyFn>(),
};

const mockTelemetryRepo = {
  appendMany: jest.fn<AnyFn>(),
  readLatestN: jest.fn<AnyFn>(),
  readSlice: jest.fn<AnyFn>(),
};

const mockAlertRepo = {
  listAlerts: jest.fn<AnyFn>(),
  findById: jest.fn<AnyFn>(),
  ackAlert: jest.fn<AnyFn>(),
  closeAlert: jest.fn<AnyFn>(),
  createAlert: jest.fn<AnyFn>(),
  countOpenByVehicle: jest.fn<AnyFn>(),
};

const mockEventRepo = {
  appendMany: jest.fn<AnyFn>(),
};

const mockScenarioRepo = {
  listDefinitions: jest.fn<AnyFn>(),
  findDefinition: jest.fn<AnyFn>(),
  startRun: jest.fn<AnyFn>(),
  findActiveRun: jest.fn<AnyFn>(),
  updateRunState: jest.fn<AnyFn>(),
};

const mockOllamaAdapter = {
  generateCompletion: jest.fn<AnyFn>(),
};

jest.unstable_mockModule('@ai-fleet/adapters', () => ({
  getPool: mockGetPool,
  closePool: jest.fn(),
  withTransaction: jest.fn(),
  PgVehicleRepository: jest.fn().mockImplementation(() => mockVehicleRepo),
  PgTelemetryRepository: jest.fn().mockImplementation(() => mockTelemetryRepo),
  PgAlertRepository: jest.fn().mockImplementation(() => mockAlertRepo),
  PgEventRepository: jest.fn().mockImplementation(() => mockEventRepo),
  PgScenarioRepository: jest.fn().mockImplementation(() => mockScenarioRepo),
  OllamaAiInferenceAdapter: jest.fn().mockImplementation(() => mockOllamaAdapter),
  DeterministicClock: jest.fn().mockImplementation(() => ({
    now: jest.fn().mockReturnValue(new Date()),
    advance: jest.fn(),
    reset: jest.fn(),
  })),
  SeededRng: jest.fn().mockImplementation(() => ({
    next: jest.fn().mockReturnValue(0.5),
    nextInt: jest.fn().mockReturnValue(42),
  })),
  NodeClockAdapter: jest.fn(),
  NodeRngAdapter: jest.fn(),
}));

// Dynamic import the app after mocking
const { buildApp } = await import('../app.js');
const { default: request } = await import('supertest');

// ─── Test harness ─────────────────────────────────────────────────────────────

let app: ReturnType<typeof buildApp>;

beforeAll(() => {
  app = buildApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /healthz', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.ts).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Fleet Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/fleet/mode', () => {
  it('returns fleet mode', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ mode: 'replay', active_run_id: null, updated_at: new Date().toISOString() }],
    });

    const res = await request(app).get('/api/fleet/mode').expect(200);
    expect(res.body.mode).toBe('replay');
    expect(res.body.active_run_id).toBeNull();
  });

  it('returns default when no row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/fleet/mode').expect(200);
    expect(res.body.mode).toBe('idle');
  });
});

describe('GET /api/fleet/vehicles', () => {
  it('returns vehicle list', async () => {
    const mockVehicles = [
      {
        id: 'veh-mum-01',
        vehicleRegNo: 'MH04AB1001',
        name: 'Fleet Van 1',
        vehicleType: 'van',
        status: 'idle',
        isActive: true,
      },
    ];
    mockVehicleRepo.list.mockResolvedValueOnce(mockVehicles);

    const res = await request(app).get('/api/fleet/vehicles').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('veh-mum-01');
    expect(res.body.total).toBe(1);
  });

  it('accepts query parameters', async () => {
    mockVehicleRepo.list.mockResolvedValueOnce([]);

    await request(app).get('/api/fleet/vehicles?limit=5&offset=0').expect(200);
    expect(mockVehicleRepo.list).toHaveBeenCalled();
  });

  it('rejects invalid limit', async () => {
    const res = await request(app).get('/api/fleet/vehicles?limit=-1').expect(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('GET /api/fleet/vehicles/:vehicleId', () => {
  it('returns vehicle detail with telemetry and alerts', async () => {
    const mockVehicle = {
      id: 'veh-mum-01',
      vehicleRegNo: 'MH04AB1001',
      name: 'Fleet Van 1',
    };
    mockVehicleRepo.findById.mockResolvedValueOnce(mockVehicle);
    mockTelemetryRepo.readLatestN.mockResolvedValueOnce([]);
    mockAlertRepo.listAlerts.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/fleet/vehicles/veh-mum-01').expect(200);
    expect(res.body.vehicle.id).toBe('veh-mum-01');
    expect(res.body.latestTelemetry).toEqual([]);
    expect(res.body.activeAlerts).toEqual([]);
  });

  it('returns 404 for non-existent vehicle', async () => {
    mockVehicleRepo.findById.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/fleet/vehicles/no-such-vehicle').expect(404);
    expect(res.body.error).toBe('vehicle not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Alert Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/alerts', () => {
  it('returns alert list', async () => {
    const mockAlerts = [
      {
        id: 'alert-001',
        alertType: 'OVERSPEED',
        severity: 'HIGH',
        status: 'OPEN',
        title: 'Overspeed Alert',
      },
    ];
    mockAlertRepo.listAlerts.mockResolvedValueOnce(mockAlerts);

    const res = await request(app).get('/api/alerts').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].alertType).toBe('OVERSPEED');
  });

  it('accepts filter parameters', async () => {
    mockAlertRepo.listAlerts.mockResolvedValueOnce([]);

    await request(app).get('/api/alerts?status=OPEN&severity=HIGH&limit=10').expect(200);
    expect(mockAlertRepo.listAlerts).toHaveBeenCalled();
  });
});

describe('POST /api/alerts/:alertId/ack', () => {
  it('acknowledges an alert', async () => {
    const ackedAlert = {
      id: 'alert-001',
      status: 'ACK',
      acknowledgedBy: 'operator-01',
    };
    mockAlertRepo.ackAlert.mockResolvedValueOnce(ackedAlert);

    const res = await request(app)
      .post('/api/alerts/alert-001/ack')
      .send({ actorId: 'operator-01', note: 'Checking' })
      .expect(200);

    expect(res.body.status).toBe('ACK');
    expect(res.body.acknowledgedBy).toBe('operator-01');
  });
});

describe('POST /api/alerts/:alertId/close', () => {
  it('closes an alert', async () => {
    const closedAlert = {
      id: 'alert-001',
      status: 'CLOSED',
    };
    mockAlertRepo.closeAlert.mockResolvedValueOnce(closedAlert);

    const res = await request(app)
      .post('/api/alerts/alert-001/close')
      .send({ resolution: 'Resolved by driver' })
      .expect(200);

    expect(res.body.status).toBe('CLOSED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Ingest Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/ingest/telemetry', () => {
  it('ingests a telemetry batch', async () => {
    mockTelemetryRepo.appendMany.mockResolvedValueOnce([]);

    const batch = {
      vehicleId: 'veh-mum-01',
      points: [
        {
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          sourceMode: 'live',
          ts: new Date().toISOString(),
          lat: 19.076,
          lng: 72.877,
          speedKph: 45,
          ignition: true,
          idling: false,
          fuelPct: 72.5,
          odometerKm: 15042,
        },
      ],
    };

    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send(batch)
      .expect(202);

    expect(res.body.ingested).toBe(1);
    expect(mockTelemetryRepo.appendMany).toHaveBeenCalledTimes(1);
  });

  it('rejects empty points array', async () => {
    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({ vehicleId: 'veh-mum-01', points: [] })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({
        vehicleId: 'veh-mum-01',
        points: [{ lat: 19.076 }],
      })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  it('rejects headingDeg >= 360', async () => {
    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({
        vehicleId: 'veh-mum-01',
        points: [
          {
            vehicleId: 'veh-mum-01',
            vehicleRegNo: 'MH04AB1001',
            sourceMode: 'live',
            ts: new Date().toISOString(),
            lat: 19.076,
            lng: 72.877,
            speedKph: 45,
            ignition: true,
            fuelPct: 72.5,
            odometerKm: 15042,
            headingDeg: 360,
          },
        ],
      })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  it('accepts headingDeg = 0', async () => {
    mockTelemetryRepo.appendMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({
        vehicleId: 'veh-mum-01',
        points: [
          {
            vehicleId: 'veh-mum-01',
            vehicleRegNo: 'MH04AB1001',
            sourceMode: 'live',
            ts: new Date().toISOString(),
            lat: 19.076,
            lng: 72.877,
            speedKph: 45,
            ignition: true,
            fuelPct: 72.5,
            odometerKm: 15042,
            headingDeg: 0,
          },
        ],
      })
      .expect(202);

    expect(res.body.ingested).toBe(1);
  });

  it('accepts headingDeg = 359.9', async () => {
    mockTelemetryRepo.appendMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({
        vehicleId: 'veh-mum-01',
        points: [
          {
            vehicleId: 'veh-mum-01',
            vehicleRegNo: 'MH04AB1001',
            sourceMode: 'live',
            ts: new Date().toISOString(),
            lat: 19.076,
            lng: 72.877,
            speedKph: 45,
            ignition: true,
            fuelPct: 72.5,
            odometerKm: 15042,
            headingDeg: 359.9,
          },
        ],
      })
      .expect(202);

    expect(res.body.ingested).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/scenarios', () => {
  it('returns scenario list', async () => {
    const mockScenarios = [
      { id: 'scenario-mixed-alert', name: 'Mixed Alert Demo', timelineSec: 120, steps: [] },
    ];
    mockScenarioRepo.listDefinitions.mockResolvedValueOnce(mockScenarios);

    const res = await request(app).get('/api/scenarios').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('scenario-mixed-alert');
  });
});

describe('GET /api/scenarios/:scenarioId', () => {
  it('returns scenario definition', async () => {
    const mockDef = { id: 'scenario-mixed-alert', name: 'Mixed Alert Demo', steps: [] };
    mockScenarioRepo.findDefinition.mockResolvedValueOnce(mockDef);

    const res = await request(app).get('/api/scenarios/scenario-mixed-alert').expect(200);
    expect(res.body.id).toBe('scenario-mixed-alert');
  });

  it('returns 404 for non-existent scenario', async () => {
    mockScenarioRepo.findDefinition.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/scenarios/no-such-scenario').expect(404);
    expect(res.body.error).toBe('scenario not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/ai/chat', () => {
  it('returns AI response', async () => {
    mockOllamaAdapter.generateCompletion.mockResolvedValueOnce({
      content: 'Fleet is operating normally.',
      model: 'deepseek-r1:8b',
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'What is the fleet status?' })
      .expect(200);

    expect(res.body.reply).toBe('Fleet is operating normally.');
    expect(res.body.model).toBe('deepseek-r1:8b');
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: '' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });
});

describe('POST /api/ai/explain-alert', () => {
  it('returns 404 for non-existent alert', async () => {
    mockAlertRepo.findById.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/ai/explain-alert')
      .send({ alertId: '00000000-0000-0000-0000-000000000001' })
      .expect(404);

    expect(res.body.error).toBe('alert not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Error Handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error handler', () => {
  it('returns 400 for Zod validation errors', async () => {
    const res = await request(app)
      .post('/api/ingest/telemetry')
      .send({})
      .expect(400);

    expect(res.body.error).toBe('validation_error');
    expect(res.body.details).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    await request(app).get('/api/nonexistent').expect(404);
  });
});
