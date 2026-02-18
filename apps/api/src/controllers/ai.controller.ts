import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OllamaAiInferenceAdapter } from '@ai-fleet/adapters';
import { PgAlertRepository, PgVehicleRepository, PgEventRepository } from '@ai-fleet/adapters';

export const aiRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(4096),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

const explainAlertSchema = z.object({
  alertId: z.string().uuid(),
});

const dailySummarySchema = z.object({
  depotId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** POST /api/ai/chat */
aiRouter.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = chatSchema.parse(req.body);
    const ai = new OllamaAiInferenceAdapter();

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an AI assistant for a fleet operations platform. ' +
          'Help operators understand telemetry data, alerts, and routes. ' +
          'Be concise and actionable.',
      },
      ...body.history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: body.message },
    ];

    const result = await ai.generateCompletion(messages);
    res.json({ reply: result.content, model: result.model });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/explain-alert */
aiRouter.post('/explain-alert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = explainAlertSchema.parse(req.body);
    const alertRepo = new PgAlertRepository();
    const alert = await alertRepo.findById(body.alertId);
    if (!alert) return res.status(404).json({ error: 'alert not found' });

    const vehicleRepo = new PgVehicleRepository();
    const vehicle = await vehicleRepo.findById(alert.vehicleId);

    const ai = new OllamaAiInferenceAdapter();
    const prompt = `
You are a fleet operations AI. Explain the following alert and suggest remediation steps.

Alert:
- Type: ${alert.eventType}
- Severity: ${alert.severity}
- Message: ${alert.message}
- Vehicle: ${vehicle?.regNo ?? alert.vehicleId} (${vehicle?.type ?? 'unknown'})
- Time: ${alert.ts.toISOString()}

Provide: 1) Root cause analysis, 2) Immediate action, 3) Preventive measures.
`.trim();

    const result = await ai.generateCompletion([
      { role: 'system', content: 'You are a fleet operations expert AI assistant.' },
      { role: 'user', content: prompt },
    ]);

    return res.json({ alertId: body.alertId, explanation: result.content, model: result.model });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/daily-summary */
aiRouter.post('/daily-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = dailySummarySchema.parse(req.body);
    const targetDate = body.date ? new Date(body.date) : new Date();
    const from = new Date(targetDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(targetDate);
    to.setHours(23, 59, 59, 999);

    const alertRepo = new PgAlertRepository();
    const eventRepo = new PgEventRepository();

    const [alerts, events] = await Promise.all([
      alertRepo.listAlerts({ from, to, limit: 100 }),
      eventRepo.listEvents({ from, to, limit: 200 }),
    ]);

    const ai = new OllamaAiInferenceAdapter();
    const prompt = `
Fleet operations summary for ${from.toDateString()}:
- Total alerts: ${alerts.length} (critical: ${alerts.filter((a) => a.severity === 'critical').length}, open: ${alerts.filter((a) => a.status === 'open').length})
- Total events: ${events.length}
- Top event types: ${Object.entries(
      events.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, c]) => `${t}(${c})`)
      .join(', ')}

Write a concise operational summary in 3-4 sentences for the fleet manager.
`.trim();

    const result = await ai.generateCompletion([
      { role: 'system', content: 'You are a fleet operations expert AI assistant.' },
      { role: 'user', content: prompt },
    ]);

    return res.json({
      date: from.toDateString(),
      summary: result.content,
      model: result.model,
      stats: { alertCount: alerts.length, eventCount: events.length },
    });
  } catch (err) {
    next(err);
  }
});
