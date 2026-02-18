import { buildApp, buildHttpServer } from './app.js';
import { getPool } from '@ai-fleet/adapters';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function main() {
  // Verify DB connection
  await getPool().query('SELECT 1');
  console.log('[server] database connected');

  const app = buildApp();
  const { httpServer } = buildHttpServer(app);

  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    console.log('[server] shutting down...');
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
