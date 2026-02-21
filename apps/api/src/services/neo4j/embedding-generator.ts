import { isNeo4jAvailable, openSession } from './neo4j.client.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'mxbai-embed-large:latest';

const log = {
  info: (msg: string, extra?: any) =>
    console.log(`[embedding-gen] ${msg}`, extra ? JSON.stringify(extra) : ''),
  debug: (msg: string, extra?: any) =>
    console.debug(`[embedding-gen] ${msg}`, extra ? JSON.stringify(extra) : ''),
  warn: (msg: string, extra?: any) =>
    console.warn(`[embedding-gen] ${msg}`, extra ? JSON.stringify(extra) : ''),
};

/**
 * EmbeddingGenerator
 *
 * Generates 1024-dimensional vector embeddings for Driver and Alert nodes using
 * Ollama mxbai-embed-large:latest, then writes them to Neo4j for vector search.
 *
 * Incremental: only processes nodes where `embedding IS NULL` or `updatedAt > embeddedAt`.
 * Gracefully skips if Ollama or Neo4j is unavailable.
 */
export class EmbeddingGenerator {
  private static instance: EmbeddingGenerator;

  private constructor() {}

  static getInstance(): EmbeddingGenerator {
    if (!EmbeddingGenerator.instance) {
      EmbeddingGenerator.instance = new EmbeddingGenerator();
    }
    return EmbeddingGenerator.instance;
  }

  /**
   * Generate and store embeddings for all un-embedded (or stale) Driver and Alert nodes.
   * Safe to call repeatedly — idempotent for already-embedded nodes.
   */
  async generateAll(): Promise<void> {
    if (!isNeo4jAvailable()) {
      log.warn('Neo4j unavailable, skipping embedding generation');
      return;
    }

    const ollamaOk = await this.checkOllama();
    if (!ollamaOk) {
      log.warn('Ollama unavailable, skipping embedding generation');
      return;
    }

    try {
      log.info('Starting embedding generation...');
      await this.generateDriverEmbeddings();
      await this.generateAlertEmbeddings();
      log.info('Embedding generation completed');
    } catch (error) {
      log.warn('Embedding generation failed (non-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Do not throw — sync service must continue regardless
    }
  }

  // ─── Ollama health check ─────────────────────────────────────────────────────

  async checkOllama(): Promise<boolean> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Driver embeddings ───────────────────────────────────────────────────────

  private async generateDriverEmbeddings(): Promise<void> {
    const session = openSession();
    try {
      // Fetch drivers that need embedding (null OR updatedAt > embeddedAt)
      const result = await session.run(
        `MATCH (d:Driver)
         WHERE d.embedding IS NULL
            OR (d.updatedAt IS NOT NULL AND d.embeddedAt IS NOT NULL AND d.updatedAt > d.embeddedAt)
         RETURN d.id AS id, d.name AS name, d.score AS score,
                d.status AS status, d.risk AS risk, d.depot AS depot`,
      );

      const nodes = result.records.map((r) => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        score: r.get('score'),
        status: r.get('status'),
        risk: r.get('risk'),
        depot: r.get('depot'),
      }));

      log.info(`Generating embeddings for ${nodes.length} driver(s)`);

      for (const d of nodes) {
        const text = `Driver: ${d.name}. Score: ${d.score}. Status: ${d.status}. Risk: ${d.risk}. Depot: ${d.depot}.`;
        const embedding = await this.fetchEmbedding(text);
        if (!embedding) continue;

        await session.run(
          `MATCH (d:Driver {id: $id})
           SET d.embedding = $embedding, d.embeddedAt = timestamp()`,
          { id: d.id, embedding },
        );
        log.debug(`Embedded driver ${d.id} (${d.name})`);
      }
    } finally {
      await session.close();
    }
  }

  // ─── Alert embeddings ────────────────────────────────────────────────────────

  private async generateAlertEmbeddings(): Promise<void> {
    const session = openSession();
    try {
      const result = await session.run(
        `MATCH (a:Alert)
         WHERE a.embedding IS NULL
            OR (a.updatedAt IS NOT NULL AND a.embeddedAt IS NOT NULL AND a.updatedAt > a.embeddedAt)
         RETURN a.id AS id, a.alertType AS alertType, a.severity AS severity,
                a.description AS description, a.vehicleReg AS vehicleReg`,
      );

      const nodes = result.records.map((r) => ({
        id: r.get('id') as string,
        alertType: r.get('alertType'),
        severity: r.get('severity'),
        description: r.get('description'),
        vehicleReg: r.get('vehicleReg'),
      }));

      log.info(`Generating embeddings for ${nodes.length} alert(s)`);

      for (const a of nodes) {
        const text = `Alert type: ${a.alertType}. Severity: ${a.severity}. Description: ${a.description}. Vehicle: ${a.vehicleReg}.`;
        const embedding = await this.fetchEmbedding(text);
        if (!embedding) continue;

        await session.run(
          `MATCH (a:Alert {id: $id})
           SET a.embedding = $embedding, a.embeddedAt = timestamp()`,
          { id: a.id, embedding },
        );
        log.debug(`Embedded alert ${a.id}`);
      }
    } finally {
      await session.close();
    }
  }

  // ─── Ollama embedding fetch ───────────────────────────────────────────────────

  async fetchEmbedding(text: string): Promise<number[] | null> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        log.warn(`Ollama embedding request failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const json = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(json.embedding)) {
        log.warn('Ollama returned no embedding array');
        return null;
      }

      return json.embedding;
    } catch (error) {
      log.warn('fetchEmbedding error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export default EmbeddingGenerator.getInstance();
