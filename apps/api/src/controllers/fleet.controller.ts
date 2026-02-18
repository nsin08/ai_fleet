import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  PgVehicleRepository,
  PgTelemetryRepository,
  PgAlertRepository,
  PgScenarioRepository,
} from '@ai-fleet/adapters';
import { getPool } from '@ai-fleet/adapters';
import type { FleetQueryPort, VehicleListFilters } from '@ai-fleet/domain';

export const fleetRouter = Router();

const listQuerySchema = z.object({
  depotId: z.string().uuid().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/fleet/mode — current fleet mode and active scenario run */
fleetRouter.get('/mode', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await getPool().query(
      `SELECT current_mode AS mode, active_scenario_run_id AS active_run_id, updated_at FROM fleet.fleet_runtime_state WHERE id = 1`,
    );
    res.json(rows[0] ?? { mode: 'idle', active_run_id: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles */
fleetRouter.get('/vehicles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const repo = new PgVehicleRepository();
    const vehicles = await repo.list(query as VehicleListFilters);
    res.json({ data: vehicles, total: vehicles.length });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles/:vehicleId */
fleetRouter.get('/vehicles/:vehicleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vehicleRepo = new PgVehicleRepository();
    const vehicle = await vehicleRepo.findById(req.params['vehicleId']!);
    if (!vehicle) return res.status(404).json({ error: 'vehicle not found' });

    const telemetryRepo = new PgTelemetryRepository();
    const alertRepo = new PgAlertRepository();

    const [latestTelemetry, activeAlerts] = await Promise.all([
      telemetryRepo.readLatestN(vehicle.id, 10),
      alertRepo.listAlerts({ vehicleId: vehicle.id, status: 'OPEN' }),
    ]);

    return res.json({ vehicle, latestTelemetry, activeAlerts });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fleet/vehicles/:vehicleId/state */
fleetRouter.get('/vehicles/:vehicleId/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgVehicleRepository();
    const state = await repo.getLatestState(req.params['vehicleId']!);
    if (!state) return res.status(404).json({ error: 'state not found' });
    return res.json(state);
  } catch (err) {
    next(err);
  }
});
