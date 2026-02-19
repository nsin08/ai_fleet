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
  mockQuery.mockReset();
  mockGetPool.mockReturnValue({ query: mockQuery });
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
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/fleet/vehicles/veh-mum-01').expect(200);
    expect(res.body.vehicle.id).toBe('veh-mum-01');
    expect(res.body.latestTelemetry).toEqual([]);
    expect(res.body.activeAlerts).toEqual([]);
    expect(res.body.currentTrip).toBeNull();
    expect(res.body.previousTrips).toEqual([]);
  });

  it('returns 404 for non-existent vehicle', async () => {
    mockVehicleRepo.findById.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/fleet/vehicles/no-such-vehicle').expect(404);
    expect(res.body.error).toBe('vehicle not found');
  });
});

describe('Dispatch routes', () => {
  it('GET /api/dispatch/trips returns trip list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'trip-001',
          vehicleId: 'veh-mum-01',
          driverId: 'drv-mum-01',
          status: 'planned',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/dispatch/trips?limit=10&offset=0').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('POST /api/dispatch/trips creates trip', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'drv-mum-01', isActive: true, availabilityStatus: 'available' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ estimated_duration_sec: 3600 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-created', vehicleId: 'veh-mum-01', driverId: 'drv-mum-01', status: 'planned' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dispatch/trips')
      .send({
        vehicleId: 'veh-mum-01',
        driverId: 'drv-mum-01',
        routeId: 'route-mum-01',
      })
      .expect(201);

    expect(res.body.status).toBe('planned');
  });

  it('POST /api/dispatch/trips blocks unavailable driver', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'drv-mum-08', isActive: true, availabilityStatus: 'off_shift' }],
    });

    const res = await request(app)
      .post('/api/dispatch/trips')
      .send({
        vehicleId: 'veh-mum-01',
        driverId: 'drv-mum-08',
      })
      .expect(409);

    expect(res.body.error).toContain('unavailable');
  });

  it('POST /api/dispatch/trips/:tripId/assign updates planned trip', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', status: 'planned', vehicleId: 'veh-mum-01', driverId: 'drv-mum-01', routeId: 'route-mum-01' }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'drv-mum-02', isActive: true, availabilityStatus: 'available' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', vehicleId: 'veh-mum-02', driverId: 'drv-mum-02', status: 'planned' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dispatch/trips/trip-001/assign')
      .send({ vehicleId: 'veh-mum-02', driverId: 'drv-mum-02' })
      .expect(200);

    expect(res.body.id).toBe('trip-001');
  });

  it('POST /api/dispatch/trips/:tripId/transition rejects invalid transition', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', status: 'completed', vehicleId: 'veh-mum-01', driverId: 'drv-mum-01', routeId: 'route-mum-01' }],
    });

    const res = await request(app)
      .post('/api/dispatch/trips/trip-001/transition')
      .send({ status: 'active' })
      .expect(409);

    expect(res.body.error).toContain('invalid transition');
  });

  it('GET /api/dispatch/trips/:tripId returns dispatch detail', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', vehicleId: 'veh-mum-01', status: 'planned' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/dispatch/trips/trip-001').expect(200);
    expect(res.body.id).toBe('trip-001');
    expect(Array.isArray(res.body.assignments)).toBe(true);
    expect(Array.isArray(res.body.exceptions)).toBe(true);
  });

  it('POST /api/dispatch/trips/:tripId/exceptions creates trip exception', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', status: 'active', vehicleId: 'veh-mum-01', driverId: 'drv-mum-01', routeId: 'route-mum-01' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', vehicleId: 'veh-mum-01', status: 'active' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'exc-001', tripId: 'trip-001', status: 'OPEN', exceptionType: 'off_route' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dispatch/trips/trip-001/exceptions')
      .send({
        exceptionType: 'off_route',
        severity: 'HIGH',
        title: 'Route deviation',
        description: 'Vehicle deviated from planned corridor',
      })
      .expect(201);

    expect(res.body.id).toBe('trip-001');
    expect(Array.isArray(res.body.exceptions)).toBe(true);
  });

  it('POST /api/dispatch/trips/:tripId/exceptions/:exceptionId/status transitions exception status', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', status: 'active', vehicleId: 'veh-mum-01', driverId: 'drv-mum-01', routeId: 'route-mum-01' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'exc-001', status: 'OPEN' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'trip-001', vehicleId: 'veh-mum-01', status: 'active' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'exc-001', tripId: 'trip-001', status: 'ACK', exceptionType: 'off_route' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/dispatch/trips/trip-001/exceptions/exc-001/status')
      .send({ status: 'ACK' })
      .expect(200);

    expect(res.body.id).toBe('trip-001');
    expect(Array.isArray(res.body.exceptions)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Alert Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Driver routes', () => {
  it('GET /api/drivers returns filtered driver list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'drv-mum-02',
          name: 'Priya Nair',
          currentSafetyScore: 79,
          availabilityStatus: 'available',
          riskBand: 'medium',
          isAssignable: true,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app)
      .get('/api/drivers?availability=available&risk=medium&limit=20&offset=0')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('drv-mum-02');
  });

  it('GET /api/drivers/:driverId returns driver profile', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'drv-mum-02',
          name: 'Priya Nair',
          baseSafetyScore: 82,
          currentSafetyScore: 79,
          availabilityStatus: 'available',
          isActive: true,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'trip-001', status: 'active' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/drivers/drv-mum-02').expect(200);
    expect(res.body.id).toBe('drv-mum-02');
    expect(Array.isArray(res.body.scoreTrend)).toBe(true);
    expect(res.body.currentTrip?.id).toBe('trip-001');
  });

  it('GET /api/drivers/:driverId/score returns score payload', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'drv-mum-02',
          baseSafetyScore: 82,
          currentSafetyScore: 79,
          availabilityStatus: 'available',
          isActive: true,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/drivers/drv-mum-02/score').expect(200);
    expect(res.body.driverId).toBe('drv-mum-02');
    expect(res.body.currentSafetyScore).toBe(79);
    expect(Array.isArray(res.body.scoreTrend)).toBe(true);
  });

  it('GET /api/drivers?availability=on_trip returns drivers with linked trip', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'drv-mum-03',
          name: 'Rajesh Patil',
          availabilityStatus: 'on_trip',
          activeTripCount: 1,
          currentTripId: 'trip-active-veh03',
          currentVehicleRegNo: 'MH04AB1003',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/drivers?availability=on_trip').expect(200);
    expect(res.body.data[0].availabilityStatus).toBe('on_trip');
    expect(res.body.data[0].currentTripId).toBeDefined();
  });
});

describe('Maintenance routes', () => {
  it('GET /api/maintenance/plans returns due queue', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'plan-001',
          vehicleId: 'veh-mum-01',
          urgency: 'HIGH',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/maintenance/plans?limit=50').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('POST /api/maintenance/work-orders creates work order and marks vehicle unavailable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'wo-001', vehicleId: 'veh-mum-01', status: 'OPEN', title: 'Brake pad inspection' }],
    });

    const res = await request(app)
      .post('/api/maintenance/work-orders')
      .send({
        vehicleId: 'veh-mum-01',
        priority: 'HIGH',
        title: 'Brake pad inspection',
      })
      .expect(201);

    expect(res.body.status).toBe('OPEN');
  });

  it('POST /api/maintenance/work-orders/:id/transition rejects invalid lifecycle transition', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wo-001', vehicleId: 'veh-mum-01', status: 'OPEN' }] });

    const res = await request(app)
      .post('/api/maintenance/work-orders/wo-001/transition')
      .send({ status: 'CLOSED' })
      .expect(409);

    expect(res.body.error).toContain('invalid work order transition');
  });

  it('POST /api/maintenance/work-orders/:id/transition advances lifecycle', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wo-001', vehicleId: 'veh-mum-01', status: 'OPEN' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wo-001', vehicleId: 'veh-mum-01', status: 'IN_PROGRESS' }] });

    const res = await request(app)
      .post('/api/maintenance/work-orders/wo-001/transition')
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(res.body.status).toBe('IN_PROGRESS');
  });
});

describe('Fuel and cost routes', () => {
  it('GET /api/fuel/anomalies returns anomaly queue with stats', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'fuel-anom-trip-001',
          vehicleId: 'veh-mum-01',
          status: 'OPEN',
          severity: 'HIGH',
          evidence: { observedDropPct: 5.2 },
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1, open: 1, confirmed: 0, dismissed: 0, resolved: 0, highRiskOpen: 1 }] });

    const res = await request(app).get('/api/fuel/anomalies?status=OPEN&limit=20').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.stats.open).toBe(1);
  });

  it('POST /api/fuel/anomalies/:eventId/disposition rejects invalid transition', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'fuel-anom-trip-001', eventType: 'anomaly', status: 'OPEN' }],
    });

    const res = await request(app)
      .post('/api/fuel/anomalies/fuel-anom-trip-001/disposition')
      .send({ status: 'RESOLVED' })
      .expect(409);

    expect(res.body.error).toContain('invalid anomaly transition');
  });

  it('POST /api/fuel/anomalies/:eventId/disposition updates anomaly state', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'fuel-anom-trip-001', eventType: 'anomaly', status: 'OPEN' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'fuel-anom-trip-001', status: 'CONFIRMED', dispositionNote: 'validated' }],
    });

    const res = await request(app)
      .post('/api/fuel/anomalies/fuel-anom-trip-001/disposition')
      .send({ status: 'CONFIRMED', note: 'validated' })
      .expect(200);

    expect(res.body.status).toBe('CONFIRMED');
  });

  it('GET /api/costs/summary returns KPI payload', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          totalCost: 14500.5,
          totalDistanceKm: 530.2,
          idleCost: 1800,
          fuelCost: 7200,
          maintenanceCost: 1600,
          driverCost: 3200,
          tollCost: 900,
          otherCost: 600,
          entryCount: 32,
          tripCount: 8,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ day: '2026-02-18', totalCost: 1200, distanceKm: 52, idleCost: 140 }],
    });

    const res = await request(app).get('/api/costs/summary?dateFrom=2026-02-10&dateTo=2026-02-19').expect(200);

    expect(res.body.totalCost).toBeGreaterThan(0);
    expect(res.body.costPerKm).toBeGreaterThan(0);
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it('GET /api/costs/by-vehicle returns grouped rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          vehicleType: 'truck',
          totalCost: 3200,
          totalDistanceKm: 140,
          idleCost: 320,
          fuelCost: 1800,
          maintenanceCost: 420,
          driverCost: 520,
          tollCost: 100,
          otherCost: 60,
          tripCount: 3,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/costs/by-vehicle?limit=10&offset=0').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].costPerKm).toBeGreaterThan(0);
  });
});

describe('Reports routes', () => {
  it('GET /api/reports/daily returns KPI metrics', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ vehicleCount: 10 }] });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          completedTrips: 8,
          activeTrips: 2,
          delayedTrips: 2,
          onTimeTrips: 6,
          distanceKm: 420,
          tripHours: 96,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ alertCount: 11, openAlertCount: 4, highAlertCount: 3 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ downtimeHours: 7.5 }] });

    const res = await request(app).get('/api/reports/daily?date=2026-02-19').expect(200);

    expect(res.body.metrics.vehicleCount).toBe(10);
    expect(res.body.metrics.utilizationRatePct).toBeGreaterThan(0);
    expect(res.body.metrics.alertBurdenPerVehicle).toBeGreaterThan(0);
  });

  it('GET /api/reports/utilization returns vehicle rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          vehicleType: 'truck',
          depotId: 'depot-mum-01',
          depotName: 'Mumbai Central Depot',
          tripCount: 3,
          distanceKm: 170,
          tripHours: 9,
          alertCount: 2,
          highAlertCount: 1,
          exceptionCount: 1,
        },
      ],
    });

    const res = await request(app)
      .get('/api/reports/utilization?dateFrom=2026-02-13&dateTo=2026-02-19')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].utilizationPct).toBeGreaterThan(0);
  });

  it('GET /api/reports/exceptions returns exception table', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'exc-001',
          tripId: 'trip-001',
          vehicleRegNo: 'MH04AB1001',
          exceptionType: 'off_route',
          severity: 'HIGH',
          status: 'OPEN',
          title: 'Route deviation',
          openedAt: new Date().toISOString(),
          durationMin: 24.5,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app)
      .get('/api/reports/exceptions?dateFrom=2026-02-13&dateTo=2026-02-19&limit=20')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('GET /api/alerts', () => {
  it('returns alert list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-001',
          alertType: 'OVERSPEED',
          severity: 'HIGH',
          status: 'OPEN',
          title: 'Overspeed Alert',
          ownerUserId: 'ops-desk',
          escalationState: 'OVERDUE',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/alerts').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].alertType).toBe('OVERSPEED');
    expect(res.body.total).toBe(1);
  });

  it('accepts filter parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });

    await request(app).get('/api/alerts?status=OPEN&severity=HIGH&limit=10').expect(200);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/alerts/:alertId/ack', () => {
  it('acknowledges an alert', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'OPEN', severity: 'HIGH', createdTs: new Date().toISOString() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'ACK', acknowledgedBy: 'operator-01' }],
    });

    const res = await request(app)
      .post('/api/alerts/alert-001/ack')
      .send({ actorId: 'operator-01', note: 'Checking' })
      .expect(200);

    expect(res.body.status).toBe('ACK');
    expect(res.body.acknowledgedBy).toBe('operator-01');
  });
});

describe('POST /api/alerts/:alertId/close', () => {
  it('requires closure reason', async () => {
    const res = await request(app)
      .post('/api/alerts/alert-001/close')
      .send({ resolution: 'Resolved by driver' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  it('closes an alert', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'ACK', severity: 'HIGH', createdTs: new Date().toISOString() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'CLOSED', closureReason: 'resolved_by_ops' }],
    });

    const res = await request(app)
      .post('/api/alerts/alert-001/close')
      .send({ closureReason: 'resolved_by_ops', resolution: 'Resolved by ops' })
      .expect(200);

    expect(res.body.status).toBe('CLOSED');
  });
});

describe('POST /api/alerts/:alertId/assign', () => {
  it('assigns owner and SLA to alert', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'OPEN', severity: 'HIGH', createdTs: new Date().toISOString() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', ownerUserId: 'ops-desk', status: 'OPEN', escalationState: 'AT_RISK' }],
    });

    const res = await request(app)
      .post('/api/alerts/alert-001/assign')
      .send({ ownerUserId: 'ops-desk', ownerDisplayName: 'Operations Desk', slaMinutes: 45 })
      .expect(200);

    expect(res.body.ownerUserId).toBe('ops-desk');
  });
});

describe('POST /api/alerts/bulk', () => {
  it('bulk assigns selected alerts', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'OPEN', severity: 'MEDIUM', createdTs: new Date().toISOString() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'alert-001', ownerUserId: 'ops-desk' }] });

    const res = await request(app)
      .post('/api/alerts/bulk')
      .send({
        action: 'assign',
        alertIds: ['alert-001'],
        ownerUserId: 'ops-desk',
        ownerDisplayName: 'Operations Desk',
        slaMinutes: 60,
      })
      .expect(200);

    expect(res.body.updatedCount).toBe(1);
  });

  it('bulk close requires closure reason', async () => {
    const res = await request(app)
      .post('/api/alerts/bulk')
      .send({
        action: 'close',
        alertIds: ['alert-001'],
      })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
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
    expect(Array.isArray(res.body.evidence?.references)).toBe(true);
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
  it('returns explanation with evidence references', async () => {
    mockAlertRepo.findById.mockResolvedValueOnce({
      id: 'alert-001',
      alertType: 'OVERSPEED',
      severity: 'HIGH',
      status: 'OPEN',
      title: 'Overspeed alert',
      description: 'Vehicle exceeded threshold',
      vehicleId: 'veh-mum-01',
      vehicleRegNo: 'MH04AB1001',
      createdTs: new Date('2026-02-19T10:00:00.000Z'),
    });
    mockVehicleRepo.findById.mockResolvedValueOnce({
      id: 'veh-mum-01',
      vehicleRegNo: 'MH04AB1001',
      vehicleType: 'truck',
    });
    mockOllamaAdapter.generateCompletion.mockResolvedValueOnce({
      content: 'Root cause likely sustained overspeed on highway segment.',
      model: 'deepseek-r1:8b',
    });

    const res = await request(app)
      .post('/api/ai/explain-alert')
      .send({ alertId: 'alert-001' })
      .expect(200);

    expect(res.body.alertId).toBe('alert-001');
    expect(res.body.explanation).toContain('Root cause');
    expect(Array.isArray(res.body.evidence?.references)).toBe(true);
    expect(res.body.evidence.references.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent alert', async () => {
    mockAlertRepo.findById.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/ai/explain-alert')
      .send({ alertId: '00000000-0000-0000-0000-000000000001' })
      .expect(404);

    expect(res.body.error).toBe('alert not found');
  });
});

describe('POST /api/ai/daily-summary', () => {
  it('returns summary with structured evidence', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-001',
          alertType: 'OVERSPEED',
          severity: 'HIGH',
          status: 'OPEN',
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          createdTs: new Date('2026-02-19T08:00:00.000Z').toISOString(),
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'evt-001',
          eventType: 'OVERSPEED',
          severity: 'HIGH',
          vehicleId: 'veh-mum-01',
          vehicleRegNo: 'MH04AB1001',
          ts: new Date('2026-02-19T08:10:00.000Z').toISOString(),
        },
      ],
    });
    mockOllamaAdapter.generateCompletion.mockResolvedValueOnce({
      content: 'Alert volume is moderate with overspeed as top event.',
      model: 'deepseek-r1:8b',
    });

    const res = await request(app)
      .post('/api/ai/daily-summary')
      .send({ date: '2026-02-19' })
      .expect(200);

    expect(res.body.summary).toContain('Alert volume');
    expect(res.body.stats.alertCount).toBe(1);
    expect(Array.isArray(res.body.evidence?.references)).toBe(true);
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

describe('RBAC and admin routes', () => {
  it('denies alert close when user lacks permission', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 'viewer-01',
          displayName: 'Viewer 01',
          roleName: 'Viewer',
          permissionsJson: ['reports:read'],
        },
      ],
    });

    const res = await request(app)
      .post('/api/alerts/alert-001/close')
      .set('x-user-id', 'viewer-01')
      .send({ closureReason: 'other' })
      .expect(403);

    expect(res.body.error).toBe('forbidden');
    expect(res.body.requiredPermission).toBe('alerts:close');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('allows alert close for authorized user and records audit entry', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 'safety-lead',
          displayName: 'Safety Lead',
          roleName: 'Safety Officer',
          permissionsJson: ['alerts:close'],
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'ACK', severity: 'HIGH', createdTs: new Date().toISOString() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-001', status: 'CLOSED', closureReason: 'resolved_by_ops' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/alerts/alert-001/close')
      .set('x-user-id', 'safety-lead')
      .send({ closureReason: 'resolved_by_ops', resolution: 'Closed by safety desk' })
      .expect(200);

    expect(res.body.status).toBe('CLOSED');
    expect(mockQuery).toHaveBeenCalledTimes(6);
  });

  it('denies admin audit log access for non-admin user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 'viewer-01',
          displayName: 'Viewer 01',
          roleName: 'Viewer',
          permissionsJson: ['reports:read'],
        },
      ],
    });

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('x-user-id', 'viewer-01')
      .expect(403);

    expect(res.body.error).toBe('forbidden');
    expect(res.body.requiredPermission).toBe('admin:audit:read');
  });

  it('returns admin users list for authorized user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 'compliance-01',
          displayName: 'Compliance 01',
          roleName: 'Audit Reader',
          permissionsJson: ['admin:users:read', 'admin:audit:read'],
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'ops-admin',
          displayName: 'Ops Admin',
          isActive: true,
          roles: [{ id: 'role_admin', name: 'Administrator', permissions: ['*'] }],
        },
      ],
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('x-user-id', 'compliance-01')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('ops-admin');
  });

  it('returns audit log rows for authorized user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 'compliance-01',
          displayName: 'Compliance 01',
          roleName: 'Audit Reader',
          permissionsJson: ['admin:users:read', 'admin:audit:read'],
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'log-001',
          actorId: 'ops-desk',
          action: 'alert.close',
          entityType: 'alert',
          entityId: 'alert-001',
          payload: { closureReason: 'resolved_by_ops' },
          ts: new Date().toISOString(),
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app)
      .get('/api/admin/audit-logs?limit=20')
      .set('x-user-id', 'compliance-01')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].action).toBe('alert.close');
  });
});
