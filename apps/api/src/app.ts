import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

import { fleetRouter } from './controllers/fleet.controller.js';
import { alertsRouter } from './controllers/alerts.controller.js';
import { scenariosRouter } from './controllers/scenarios.controller.js';
import { ingestRouter } from './controllers/ingest.controller.js';
import { aiRouter } from './controllers/ai.controller.js';
import { dispatchRouter } from './controllers/dispatch.controller.js';
import { driversRouter } from './controllers/drivers.controller.js';
import { maintenanceRouter } from './controllers/maintenance.controller.js';
import { fuelRouter, costsRouter } from './controllers/costs.controller.js';
import { reportsRouter } from './controllers/reports.controller.js';
import { adminRouter } from './controllers/admin.controller.js';
import { WsGateway } from './ws/ws-gateway.js';
import { errorHandler } from './middleware/error-handler.js';
import { ReplayEngine } from './services/replay/replay-engine.js';
import { RuleEngine } from './services/rules/rule-engine.js';
import {
  verifyNeo4jConnectivity,
  applySchema,
  closeNeo4jDriver,
  isNeo4jAvailable,
} from './services/neo4j/neo4j.client.js';

export function buildApp(): ReturnType<typeof express> {
  const app = express();

  // ─── Middleware ─────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? '*' }));
  app.use(morgan('combined'));
  app.use(express.json({ limit: '1mb' }));

  // ─── Routes ─────────────────────────────────────────────────────────────────
  app.use('/api/fleet', fleetRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/scenarios', scenariosRouter);
  app.use('/api/ingest', ingestRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dispatch', dispatchRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/maintenance', maintenanceRouter);
  app.use('/api/fuel', fuelRouter);
  app.use('/api/costs', costsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/admin', adminRouter);

  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      ts: new Date().toISOString(),
      neo4j: isNeo4jAvailable() ? 'connected' : 'unavailable',
    });
  });

  // ─── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  return app;
}

export function buildHttpServer(app: ReturnType<typeof express>) {
  const httpServer = createServer(app);
  const wsGateway = new WsGateway(httpServer);
  ReplayEngine.init();
  RuleEngine.init();
  return { httpServer, wsGateway };
}

/**
 * Initialize Neo4j: verify connectivity and apply schema (idempotent).
 * Non-fatal — if Neo4j is unreachable the API continues without graph context.
 * AI routes should check isNeo4jAvailable() and return a graceful fallback.
 */
export async function initNeo4j(): Promise<void> {
  try {
    await verifyNeo4jConnectivity();
    await applySchema();
  } catch (err) {
    console.warn(
      '[neo4j] ⚠ Neo4j unavailable on startup — AI graph context disabled.',
      err instanceof Error ? err.message : err,
    );
    // Non-fatal: rest of API continues without Neo4j
  }
}

/**
 * Close Neo4j driver — call on SIGTERM/SIGINT.
 */
export { closeNeo4jDriver, isNeo4jAvailable };
