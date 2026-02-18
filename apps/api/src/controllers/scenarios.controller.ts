import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PgScenarioRepository } from '@ai-fleet/adapters';
import { getPool } from '@ai-fleet/adapters';
import { ReplayEngine } from '../services/replay/replay-engine.js';

export const scenariosRouter = Router();

const runBodySchema = z.object({
  seed: z.number().int().optional(),
  speedFactor: z.number().min(0.1).max(10).default(1.0),
});

/** GET /api/scenarios — list available scenario definitions */
scenariosRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgScenarioRepository();
    const definitions = await repo.listDefinitions();
    res.json({ data: definitions });
  } catch (err) {
    next(err);
  }
});

/** GET /api/scenarios/:scenarioId */
scenariosRouter.get('/:scenarioId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgScenarioRepository();
    const def = await repo.findDefinition(req.params['scenarioId']!);
    if (!def) return res.status(404).json({ error: 'scenario not found' });
    return res.json(def);
  } catch (err) {
    next(err);
  }
});

/** POST /api/scenarios/:scenarioId/run — start a replay run */
scenariosRouter.post('/:scenarioId/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = runBodySchema.parse(req.body);
    const repo = new PgScenarioRepository();

    // Stop any running scenario first
    const active = await repo.findActiveRun('replay');
    if (active) {
      ReplayEngine.getInstance()?.stop();
      await repo.updateRunState(active.id, 'FAILED');
    }

    const run = await repo.startRun({
      scenarioId: req.params['scenarioId']!,
      mode: 'replay',
      seed: body.seed,
      speedFactor: body.speedFactor,
    });

    // Flip fleet mode to replay
    await getPool().query(
      `UPDATE fleet.fleet_runtime_state SET current_mode = 'replay', active_scenario_run_id = $1, updated_at = NOW() WHERE id = 1`,
      [run.id],
    );

    ReplayEngine.getInstance()?.start(run);
    return res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

/** POST /api/scenarios/runs/:runId/pause */
scenariosRouter.post('/runs/:runId/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgScenarioRepository();
    ReplayEngine.getInstance()?.pause();
    const run = await repo.updateRunState(req.params['runId']!, 'PAUSED');
    return res.json(run);
  } catch (err) {
    next(err);
  }
});

/** POST /api/scenarios/runs/:runId/resume */
scenariosRouter.post('/runs/:runId/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgScenarioRepository();
    const run = await repo.updateRunState(req.params['runId']!, 'RUNNING');
    ReplayEngine.getInstance()?.resume(run);
    return res.json(run);
  } catch (err) {
    next(err);
  }
});

/** POST /api/scenarios/runs/:runId/reset */
scenariosRouter.post('/runs/:runId/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgScenarioRepository();
    ReplayEngine.getInstance()?.stop();
    const run = await repo.updateRunState(req.params['runId']!, 'RESET');
    await getPool().query(
      `UPDATE fleet.fleet_runtime_state SET current_mode = 'replay', active_scenario_run_id = NULL, updated_at = NOW() WHERE id = 1`,
    );
    return res.json(run);
  } catch (err) {
    next(err);
  }
});
