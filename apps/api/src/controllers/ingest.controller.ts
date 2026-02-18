import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PgTelemetryRepository, PgEventRepository } from '@ai-fleet/adapters';
import type { TelemetryPoint, FleetEvent } from '@ai-fleet/domain';
import { RuleEngine } from '../services/rules/rule-engine.js';

export const ingestRouter = Router();

const telemetryPointSchema = z.object({
  vehicleId: z.string(),
  vehicleRegNo: z.string(),
  tripId: z.string().optional(),
  scenarioRunId: z.string().optional(),
  sourceMode: z.enum(['replay', 'live']),
  sourceEmitterId: z.string().optional(),
  ts: z.string().datetime(),
  tsEpochMs: z.number().optional(),
  lat: z.number(),
  lng: z.number(),
  speedKph: z.number().min(0),
  ignition: z.boolean(),
  idling: z.boolean().optional().default(false),
  fuelPct: z.number().min(0).max(100),
  engineTempC: z.number().optional(),
  batteryV: z.number().optional(),
  odometerKm: z.number().min(0),
  headingDeg: z.number().min(0).lt(360).optional(),
  rpm: z.number().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const batchSchema = z.object({
  vehicleId: z.string(),
  points: z.array(telemetryPointSchema).min(1).max(500),
});

/** POST /api/ingest/telemetry — batch telemetry from live emitters */
ingestRouter.post('/telemetry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = batchSchema.parse(req.body);
    const points = body.points.map((p) => ({
      ...p,
      ts: new Date(p.ts),
      tsEpochMs: p.tsEpochMs ?? new Date(p.ts).getTime(),
    })) as unknown as TelemetryPoint[];

    const repo = new PgTelemetryRepository();
    await repo.appendMany(points);

    // Run rule engine async — don't block response
    RuleEngine.getInstance()
      ?.evaluate(points)
      .catch((err) => console.error('[rule-engine] evaluation error', err));

    res.status(202).json({ ingested: points.length });
  } catch (err) {
    next(err);
  }
});

const eventBatchSchema = z.object({
  vehicleId: z.string(),
  events: z.array(z.object({
    id: z.string().uuid(),
    vehicleId: z.string(),
    vehicleRegNo: z.string(),
    driverId: z.string().optional(),
    tripId: z.string().optional(),
    scenarioRunId: z.string().optional(),
    sourceMode: z.enum(['replay', 'live']),
    sourceEmitterId: z.string().optional(),
    source: z.string(),
    ts: z.string().datetime(),
    eventType: z.string(),
    severity: z.string(),
    message: z.string(),
    metadata: z.record(z.unknown()).optional().default({}),
  })).min(1),
});

/** POST /api/ingest/events — batch events from live emitters */
ingestRouter.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = eventBatchSchema.parse(req.body);
    const events = body.events.map((e) => ({
      ...e,
      ts: new Date(e.ts),
    })) as unknown as FleetEvent[];

    const repo = new PgEventRepository();
    await repo.appendMany(events);

    res.status(202).json({ ingested: events.length });
  } catch (err) {
    next(err);
  }
});
