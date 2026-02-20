import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OllamaAiInferenceAdapter, PgAlertRepository, PgVehicleRepository, getPool } from '@ai-fleet/adapters';
import { runOpsEdgeChat } from '../services/ai/agent.js';

const AI_UNAVAILABLE_REPLY = 'OpsEdge AI is temporarily unavailable. Please try again in a moment.';

function gracefulAiError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn('[opsedge-ai] error:', msg);
}

export const aiRouter = Router();

const evidenceReferenceSchema = z.object({
  refType: z.enum(['page', 'alert', 'vehicle', 'event', 'trip', 'driver', 'depot', 'metric', 'timestamp']),
  refId: z.string().optional(),
  label: z.string().min(1).max(200),
  ts: z.string().datetime().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  meta: z.record(z.unknown()).optional(),
});

const evidencePayloadSchema = z.object({
  generatedAt: z.string().datetime(),
  references: z.array(evidenceReferenceSchema).max(50),
});

const chatContextSchema = z.object({
  page: z.string().max(200).optional(),
  entityType: z.enum(['vehicle', 'alert', 'trip', 'driver', 'depot']).optional(),
  entityId: z.string().max(120).optional(),
  timezone: z.string().max(80).optional(),
});

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
  context: chatContextSchema.optional(),
});

const explainAlertSchema = z.object({
  alertId: z.string().min(1),
});

const dailySummarySchema = z.object({
  depotId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
type ChatContext = z.infer<typeof chatContextSchema>;

/** POST /api/ai/chat — LangGraph ReAct agent with fleet data tools */
aiRouter.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  let body: z.infer<typeof chatSchema>;
  try {
    body = chatSchema.parse(req.body);
  } catch (validationErr) {
    return next(validationErr); // let Zod errors propagate as 400
  }

  try {
    const result = await runOpsEdgeChat(body.message, body.history);

    const evidence = buildEvidencePayload([
      { refType: 'timestamp', label: 'response_generated_at', ts: new Date().toISOString() },
    ]);

    return res.json({
      reply: result.reply,
      model: result.model,
      evidence,
      references: evidence.references,
      context: body.context ?? null,
    });
  } catch (err) {
    gracefulAiError(err);
    return res.json({
      reply: AI_UNAVAILABLE_REPLY,
      model: 'unavailable',
      evidence: buildEvidencePayload([]),
      references: [],
      context: null,
    });
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

    const references: EvidenceReference[] = [
      {
        refType: 'alert',
        refId: alert.id,
        label: `${alert.alertType} ${alert.severity} ${alert.status}`,
        ts: alert.createdTs.toISOString(),
      },
      {
        refType: 'vehicle',
        refId: alert.vehicleId,
        label: vehicle?.vehicleRegNo ?? alert.vehicleRegNo,
      },
      {
        refType: 'timestamp',
        label: 'alert_created_at',
        ts: alert.createdTs.toISOString(),
      },
    ];

    const ai = new OllamaAiInferenceAdapter();
    const prompt = `
You are a fleet operations AI. Explain the following alert and suggest remediation steps.

Alert:
- ID: ${alert.id}
- Type: ${alert.alertType}
- Severity: ${alert.severity}
- Status: ${alert.status}
- Title: ${alert.title}
- Description: ${alert.description}
- Vehicle: ${vehicle?.vehicleRegNo ?? alert.vehicleId} (${vehicle?.vehicleType ?? 'unknown'})
- Time: ${alert.createdTs.toISOString()}

Provide:
1) Root cause analysis
2) Immediate action
3) Preventive measures
4) Explicitly mention relevant references (alert id, vehicle, timestamps).
`.trim();

    const result = await ai.generateCompletion([
      { role: 'system', content: 'You are a fleet operations expert AI assistant.' },
      { role: 'user', content: prompt },
    ]);

    const evidence = buildEvidencePayload(references);

    return res.json({
      alertId: body.alertId,
      explanation: result.content,
      model: result.model,
      evidence,
      references: evidence.references,
    });
  } catch (err) {
    gracefulAiError(err);
    return res.json({
      alertId: req.body?.alertId ?? null,
      explanation: AI_UNAVAILABLE_REPLY,
      model: 'unavailable',
      evidence: buildEvidencePayload([]),
      references: [],
    });
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

    const params: unknown[] = [from, to];
    const depotFilterSql = body.depotId ? 'AND v.depot_id = $3' : '';
    if (body.depotId) params.push(body.depotId);

    const alertsQuery = `
      SELECT
        a.id,
        a.alert_type AS "alertType",
        a.severity,
        a.status,
        a.vehicle_id AS "vehicleId",
        a.vehicle_reg_no AS "vehicleRegNo",
        a.created_ts AS "createdTs"
      FROM fleet.alerts a
      LEFT JOIN fleet.vehicles v ON v.id = a.vehicle_id
      WHERE a.created_ts >= $1
        AND a.created_ts <= $2
        ${depotFilterSql}
      ORDER BY a.created_ts DESC
      LIMIT 200
    `;

    const eventsQuery = `
      SELECT
        e.id,
        e.event_type AS "eventType",
        e.severity,
        e.vehicle_id AS "vehicleId",
        e.vehicle_reg_no AS "vehicleRegNo",
        e.ts
      FROM fleet.events e
      LEFT JOIN fleet.vehicles v ON v.id = e.vehicle_id
      WHERE e.ts >= $1
        AND e.ts <= $2
        ${depotFilterSql}
      ORDER BY e.ts DESC
      LIMIT 300
    `;

    const [alertsResult, eventsResult, depotResult] = await Promise.all([
      getPool().query(alertsQuery, params),
      getPool().query(eventsQuery, params),
      body.depotId
        ? getPool().query(
            `SELECT id, name FROM fleet.depots WHERE id = $1`,
            [body.depotId],
          )
        : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    ]);

    const alerts = alertsResult.rows;
    const events = eventsResult.rows;

    const openAlerts = alerts.filter((a) => String(a['status']) === 'OPEN');
    const highAlerts = alerts.filter((a) => ['HIGH', 'CRITICAL'].includes(String(a['severity'])));

    const eventTypeCounts = events.reduce<Record<string, number>>((acc, event) => {
      const key = String(event['eventType']);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const topEventTypes = Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const ai = new OllamaAiInferenceAdapter();
    const prompt = `
Fleet operations summary for ${from.toISOString().slice(0, 10)}${body.depotId ? ` at depot ${body.depotId}` : ''}:
- Total alerts: ${alerts.length} (high/critical: ${highAlerts.length}, open: ${openAlerts.length})
- Total events: ${events.length}
- Top event types: ${topEventTypes.map(([t, c]) => `${t}(${c})`).join(', ') || 'none'}

Write a concise operational summary in 3-4 sentences for the fleet manager.
Also include one priority action and one watch item.
`.trim();

    const result = await ai.generateCompletion([
      { role: 'system', content: 'You are a fleet operations expert AI assistant.' },
      { role: 'user', content: prompt },
    ]);

    const references: EvidenceReference[] = [
      { refType: 'timestamp', label: 'summary_window_start', ts: from.toISOString() },
      { refType: 'timestamp', label: 'summary_window_end', ts: to.toISOString() },
      { refType: 'metric', label: 'alert_count', value: alerts.length },
      { refType: 'metric', label: 'open_alert_count', value: openAlerts.length },
      { refType: 'metric', label: 'high_alert_count', value: highAlerts.length },
      { refType: 'metric', label: 'event_count', value: events.length },
    ];

    if (body.depotId) {
      const depotName = String(depotResult.rows[0]?.['name'] ?? body.depotId);
      references.push({ refType: 'depot', refId: body.depotId, label: depotName });
    }

    for (const alert of alerts.slice(0, 3)) {
      references.push({
        refType: 'alert',
        refId: String(alert['id']),
        label: `${String(alert['alertType'])} ${String(alert['severity'])} ${String(alert['status'])}`,
        ts: new Date(String(alert['createdTs'])).toISOString(),
        meta: {
          vehicleId: alert['vehicleId'],
          vehicleRegNo: alert['vehicleRegNo'],
        },
      });
    }

    for (const [eventType, count] of topEventTypes) {
      references.push({
        refType: 'event',
        label: `event_type_${eventType}`,
        value: count,
      });
    }

    const evidence = buildEvidencePayload(references);

    return res.json({
      date: from.toISOString().slice(0, 10),
      summary: result.content,
      model: result.model,
      stats: {
        alertCount: alerts.length,
        openAlertCount: openAlerts.length,
        highAlertCount: highAlerts.length,
        eventCount: events.length,
      },
      evidence,
      references: evidence.references,
    });
  } catch (err) {
    gracefulAiError(err);
    return res.json({
      date: new Date().toISOString().slice(0, 10),
      summary: AI_UNAVAILABLE_REPLY,
      model: 'unavailable',
      stats: { alertCount: 0, openAlertCount: 0, highAlertCount: 0, eventCount: 0 },
      evidence: buildEvidencePayload([]),
      references: [],
    });
  }
});

function buildEvidencePayload(references: EvidenceReference[]) {
  return evidencePayloadSchema.parse({
    generatedAt: new Date().toISOString(),
    references,
  });
}

async function buildContextReferences(context: ChatContext | undefined): Promise<EvidenceReference[]> {
  if (!context) return [];

  const references: EvidenceReference[] = [];

  if (context.page) {
    references.push({ refType: 'page', label: `page:${context.page}`, value: context.page });
  }

  if (!context.entityType || !context.entityId) {
    return references;
  }

  if (context.entityType === 'alert') {
    const alertResult = await getPool().query(
      `SELECT id, alert_type AS "alertType", severity, status, created_ts AS "createdTs", vehicle_id AS "vehicleId", vehicle_reg_no AS "vehicleRegNo"
       FROM fleet.alerts
       WHERE id = $1`,
      [context.entityId],
    );
    const alert = alertResult.rows[0];
    if (alert) {
      references.push({
        refType: 'alert',
        refId: String(alert['id']),
        label: `${String(alert['alertType'])} ${String(alert['severity'])} ${String(alert['status'])}`,
        ts: new Date(String(alert['createdTs'])).toISOString(),
      });
      references.push({
        refType: 'vehicle',
        refId: String(alert['vehicleId']),
        label: String(alert['vehicleRegNo']),
      });
    }
    return references;
  }

  if (context.entityType === 'vehicle') {
    const result = await getPool().query(
      `SELECT id, vehicle_reg_no AS "vehicleRegNo", status, depot_id AS "depotId"
       FROM fleet.vehicles
       WHERE id = $1`,
      [context.entityId],
    );
    const vehicle = result.rows[0];
    if (vehicle) {
      references.push({
        refType: 'vehicle',
        refId: String(vehicle['id']),
        label: String(vehicle['vehicleRegNo']),
        meta: { status: vehicle['status'], depotId: vehicle['depotId'] },
      });
    }
    return references;
  }

  if (context.entityType === 'trip') {
    const result = await getPool().query(
      `SELECT id, status, vehicle_id AS "vehicleId", driver_id AS "driverId", started_at AS "startedAt"
       FROM fleet.trips
       WHERE id = $1`,
      [context.entityId],
    );
    const trip = result.rows[0];
    if (trip) {
      references.push({
        refType: 'trip',
        refId: String(trip['id']),
        label: `trip ${String(trip['status'])}`,
        ts: new Date(String(trip['startedAt'])).toISOString(),
        meta: { vehicleId: trip['vehicleId'], driverId: trip['driverId'] },
      });
    }
    return references;
  }

  if (context.entityType === 'driver') {
    const result = await getPool().query(
      `SELECT id, name, current_safety_score::int AS "currentSafetyScore", availability_status AS "availabilityStatus"
       FROM fleet.drivers
       WHERE id = $1`,
      [context.entityId],
    );
    const driver = result.rows[0];
    if (driver) {
      references.push({
        refType: 'driver',
        refId: String(driver['id']),
        label: String(driver['name']),
        meta: {
          currentSafetyScore: driver['currentSafetyScore'],
          availabilityStatus: driver['availabilityStatus'],
        },
      });
    }
    return references;
  }

  const depotResult = await getPool().query(
    `SELECT id, name, city
     FROM fleet.depots
     WHERE id = $1`,
    [context.entityId],
  );
  const depot = depotResult.rows[0];
  if (depot) {
    references.push({
      refType: 'depot',
      refId: String(depot['id']),
      label: String(depot['name']),
      meta: { city: depot['city'] },
    });
  }

  return references;
}
