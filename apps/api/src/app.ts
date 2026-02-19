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
    res.json({ status: 'ok', ts: new Date().toISOString() });
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
