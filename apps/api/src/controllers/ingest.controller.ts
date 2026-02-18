import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PgTelemetryRepository, PgEventRepository } from '@ai-fleet/adapters';
import type { TelemetryPoint, FleetEvent } from '@ai-fleet/domain';
import { TelemetrySourceMode } from '@ai-fleet/domain';
import { RuleEngine } from '../services/rules/rule-engine.js';

export const ingestRouter = Router();

const telemetryPointSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  ts: z.string().datetime(),
  lat: z.number(),
  lng: z.number(),
  speedKmh: z.number().min(0),
  heading: z.number().min(0).max(360).optional(),
  odometerKm: z.number().min(0),
  fuelPct: z.number().min(0).max(100),
  engineOn: z.boolean(),
  sourceMode: z.nativeEnum(TelemetrySourceMode),
});

const batchSchema = z.object({
  vehicleId: z.string().uuid(),
  points: z.array(telemetryPointSchema).min(1).max(500),
});

/** POST /api/ingest/telemetry — batch telemetry from live emitters */
ingestRouter.post('/telemetry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = batchSchema.parse(req.body);
    const points: TelemetryPoint[] = body.points.map((p) => ({
      ...p,
      ts: new Date(p.ts),
    }));

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
  vehicleId: z.string().uuid(),
  events: z.array(z.object({
    id: z.string().uuid(),
    vehicleId: z.string().uuid(),
    ts: z.string().datetime(),
    type: z.string(),
    severity: z.string(),
    source: z.string(),
    value: z.number().optional(),
    meta: z.record(z.unknown()).optional(),
  })).min(1),
});

/** POST /api/ingest/events — batch events from live emitters */
ingestRouter.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = eventBatchSchema.parse(req.body);
    const events = body.events.map((e) => ({
      ...e,
      ts: new Date(e.ts),
    })) as FleetEvent[];

    const repo = new PgEventRepository();
    await repo.appendMany(events);

    res.status(202).json({ ingested: events.length });
  } catch (err) {
    next(err);
  }
});
