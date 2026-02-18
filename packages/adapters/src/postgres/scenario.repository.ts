import type {
  ScenarioRepositoryPort,
  StartRunOptions,
} from '@ai-fleet/domain';
import type {
  ScenarioDefinition,
  ScenarioRun,
  ScenarioRunStatus,
  FleetMode,
} from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgScenarioRepository implements ScenarioRepositoryPort {
  async findDefinition(scenarioId: string): Promise<ScenarioDefinition | null> {
    const { rows } = await getPool().query(
      `SELECT sd.*, COALESCE(
         json_agg(sds ORDER BY sds.step_order) FILTER (WHERE sds.id IS NOT NULL),
         '[]'
       ) AS steps
       FROM fleet.scenario_definitions sd
       LEFT JOIN fleet.scenario_definition_steps sds ON sds.scenario_id = sd.id
       WHERE sd.id = $1
       GROUP BY sd.id`,
      [scenarioId],
    );
    return rows[0] ? mapDefinitionRow(rows[0]) : null;
  }

  async listDefinitions(): Promise<ScenarioDefinition[]> {
    const { rows } = await getPool().query(
      `SELECT sd.*, COALESCE(
         json_agg(sds ORDER BY sds.step_order) FILTER (WHERE sds.id IS NOT NULL),
         '[]'
       ) AS steps
       FROM fleet.scenario_definitions sd
       LEFT JOIN fleet.scenario_definition_steps sds ON sds.scenario_id = sd.id
       GROUP BY sd.id
       ORDER BY sd.name`,
    );
    return rows.map(mapDefinitionRow);
  }

  async startRun(opts: StartRunOptions): Promise<ScenarioRun> {
    const { rows } = await getPool().query(
      `INSERT INTO fleet.scenario_runs
         (scenario_id, status, started_at, seed, speed_factor)
       VALUES ($1, 'running', NOW(), $2, $3)
       RETURNING *`,
      [opts.scenarioId, opts.seed ?? null, opts.speedFactor ?? 1.0],
    );
    return mapRunRow(rows[0]);
  }

  async updateRunState(
    runId: string,
    status: ScenarioRunStatus,
    cursorTs?: Date,
  ): Promise<ScenarioRun> {
    const extra = cursorTs ? `, cursor_ts = $3` : '';
    const params: unknown[] = [runId, status];
    if (cursorTs) params.push(cursorTs);

    const finishedClause =
      status === 'completed' || status === 'failed'
        ? `, finished_at = NOW()`
        : '';

    const { rows } = await getPool().query(
      `UPDATE fleet.scenario_runs
       SET status = $2${extra}${finishedClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params,
    );
    if (!rows[0]) throw new Error(`ScenarioRun ${runId} not found`);
    return mapRunRow(rows[0]);
  }

  async findRun(runId: string): Promise<ScenarioRun | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.scenario_runs WHERE id = $1`,
      [runId],
    );
    return rows[0] ? mapRunRow(rows[0]) : null;
  }

  async findActiveRun(_mode: FleetMode): Promise<ScenarioRun | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.scenario_runs
       WHERE status IN ('running', 'paused')
       ORDER BY started_at DESC
       LIMIT 1`,
    );
    return rows[0] ? mapRunRow(rows[0]) : null;
  }
}

function mapDefinitionRow(row: Record<string, unknown>): ScenarioDefinition {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    description: row['description'] as string | undefined,
    durationSeconds: row['duration_seconds'] as number,
    vehicleCount: row['vehicle_count'] as number,
    steps: (row['steps'] as unknown[]) ?? [],
  } as ScenarioDefinition;
}

function mapRunRow(row: Record<string, unknown>): ScenarioRun {
  return {
    id: row['id'] as string,
    scenarioId: row['scenario_id'] as string,
    status: row['status'] as ScenarioRunStatus,
    startedAt: row['started_at'] as Date,
    finishedAt: row['finished_at'] as Date | undefined,
    cursorTs: row['cursor_ts'] as Date | undefined,
    seed: row['seed'] as number | undefined,
    speedFactor: row['speed_factor'] as number,
  };
}
