import { buildApp, buildHttpServer, initNeo4j, closeNeo4jDriver } from './app.js';
import { getPool } from '@ai-fleet/adapters';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function main() {
  // Verify DB connection
  await getPool().query('SELECT 1');
  console.log('[server] database connected');

  // Initialize Neo4j (non-fatal — API continues if unavailable)
  await initNeo4j();

  const app = buildApp();
  const { httpServer } = buildHttpServer(app);

  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    console.log('[server] shutting down...');
    httpServer.close();
    await closeNeo4jDriver();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
