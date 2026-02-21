import { buildApp, buildHttpServer, initNeo4j, closeNeo4jDriver } from './app.js';
import { getPool } from '@ai-fleet/adapters';
import neo4jSync from './services/neo4j/neo4j-sync.service.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function main() {
  // Verify DB connection
  await getPool().query('SELECT 1');
  console.log('[server] database connected');

  // Initialize Neo4j (non-fatal — API continues if unavailable)
  await initNeo4j();

  // Run full sync on startup
  await neo4jSync.syncAll();

  // Schedule delta sync every 5 minutes
  const syncTimer = setInterval(() => {
    neo4jSync.syncDelta().catch((err) => {
      console.warn('[server] delta sync error (non-fatal)', err);
    });
  }, SYNC_INTERVAL_MS);

  const app = buildApp();
  const { httpServer } = buildHttpServer(app);

  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    console.log('[server] shutting down...');
    clearInterval(syncTimer);
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
