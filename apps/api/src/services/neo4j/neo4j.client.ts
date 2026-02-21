import neo4j, { Driver, Session, auth } from 'neo4j-driver';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Neo4j Client — singleton driver with connection pooling
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _driver: Driver | null = null;
let _isAvailable = false;

/**
 * Initialize and return the Neo4j driver (singleton).
 * Safe to call multiple times — returns cached instance on subsequent calls.
 */
export function getNeo4jDriver(): Driver {
  if (_driver) return _driver;

  const uri = process.env['NEO4J_URI'] ?? 'bolt://localhost:7687';
  const user = process.env['NEO4J_USER'] ?? 'neo4j';
  const password = process.env['NEO4J_PASSWORD'] ?? 'password';

  _driver = neo4j.driver(uri, auth.basic(user, password), {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 5000,
    logging: {
      level: process.env['NODE_ENV'] === 'development' ? 'warn' : 'error',
      logger: (level, message) => {
        if (level === 'error') console.error(`[neo4j] ${message}`);
        else if (level === 'warn') console.warn(`[neo4j] ${message}`);
      },
    },
  });

  return _driver;
}

/**
 * Verify connectivity and mark Neo4j as available.
 * Throws if Neo4j is unreachable.
 */
export async function verifyNeo4jConnectivity(): Promise<void> {
  const driver = getNeo4jDriver();
  await driver.verifyConnectivity();
  _isAvailable = true;
  console.log('[neo4j] connected');
}

/**
 * Returns true if Neo4j is available (verified on startup).
 * Used for graceful degradation in AI routes.
 */
export function isNeo4jAvailable(): boolean {
  return _isAvailable;
}

/**
 * Mark Neo4j as unavailable (called when a query fails).
 */
export function setNeo4jUnavailable(): void {
  _isAvailable = false;
}

/**
 * Open a new Neo4j session. Caller is responsible for closing it.
 */
export function openSession(): Session {
  return getNeo4jDriver().session({ database: 'neo4j' });
}

/**
 * Load and execute the schema.cypher file on the connected Neo4j instance.
 * Each statement is separated by a semicolon. Safe to run multiple times
 * (all statements use IF NOT EXISTS).
 */
export async function applySchema(): Promise<void> {
  // Resolve schema file relative to repo root (works in both dev and prod)
  const schemaPath = resolve(__dirname, '../../../../../../db/neo4j/schema.cypher');

  let schemaContent: string;
  try {
    schemaContent = readFileSync(schemaPath, 'utf-8');
  } catch {
    // Fallback path for dist layout
    const altPath = resolve(process.cwd(), 'db/neo4j/schema.cypher');
    schemaContent = readFileSync(altPath, 'utf-8');
  }

  // Split on semicolons, skip comment lines and blank statements
  const statements = schemaContent
    .split(';')
    .map((s) => s.replace(/\/\/.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  const session = openSession();
  try {
    for (const stmt of statements) {
      await session.run(stmt);
    }
    console.log(`[neo4j] schema applied (${statements.length} statements)`);
  } finally {
    await session.close();
  }
}

/**
 * Gracefully close the driver on app shutdown.
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
    _isAvailable = false;
    console.log('[neo4j] driver closed');
  }
}
