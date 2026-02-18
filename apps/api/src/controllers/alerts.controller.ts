import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PgAlertRepository } from '@ai-fleet/adapters';

export const alertsRouter = Router();

const listQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  status: z.enum(['open', 'acknowledged', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ackBodySchema = z.object({
  acknowledgedBy: z.string().min(1),
});

/** GET /api/alerts */
alertsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const repo = new PgAlertRepository();
    const alerts = await repo.listAlerts({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    res.json({ data: alerts, total: alerts.length });
  } catch (err) {
    next(err);
  }
});

/** GET /api/alerts/:alertId */
alertsRouter.get('/:alertId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = new PgAlertRepository();
    const alert = await repo.findById(req.params['alertId']!);
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    return res.json(alert);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/:alertId/ack */
alertsRouter.post('/:alertId/ack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ackBodySchema.parse(req.body);
    const repo = new PgAlertRepository();
    const alert = await repo.ackAlert({
      alertId: req.params['alertId']!,
      acknowledgedBy: body.acknowledgedBy,
    });
    return res.json(alert);
  } catch (err) {
    next(err);
  }
});

/** POST /api/alerts/:alertId/close */
alertsRouter.post('/:alertId/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resolution: string | undefined = (req.body as Record<string, string>)['resolution'];
    const repo = new PgAlertRepository();
    const alert = await repo.closeAlert(req.params['alertId']!, resolution);
    return res.json(alert);
  } catch (err) {
    next(err);
  }
});
