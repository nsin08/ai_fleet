import type {
  ScenarioRepositoryPort,
  StartRunOptions,
} from '@ai-fleet/domain';
import type {
  ScenarioDefinition,
  ScenarioDefinitionStep,
  ScenarioRun,
  ScenarioRunStatus,
  FleetMode,
} from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgScenarioRepository implements ScenarioRepositoryPort {
  async findDefinition(scenarioId: string): Promise<ScenarioDefinition | null> {
    const { rows } = await getPool().query(
      `SELECT sd.*, COALESCE(
         json_agg(json_build_object(
           'scenarioId', sds.scenario_id,
           'stepNo',     sds.step_no,
           'atSec',      sds.at_sec,
           'action',     sds.action,
           'data',       sds.data
         ) ORDER BY sds.step_no) FILTER (WHERE sds.scenario_id IS NOT NULL),
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
         json_agg(json_build_object(
           'scenarioId', sds.scenario_id,
           'stepNo',     sds.step_no,
           'atSec',      sds.at_sec,
           'action',     sds.action,
           'data',       sds.data
         ) ORDER BY sds.step_no) FILTER (WHERE sds.scenario_id IS NOT NULL),
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
         (scenario_id, mode, status, started_at, seed, speed_factor, metadata)
       VALUES ($1, $2, 'RUNNING', NOW(), $3, $4, $5::jsonb)
       RETURNING *`,
      [
        opts.scenarioId,
        opts.mode ?? 'replay',
        opts.seed ?? null,
        opts.speedFactor ?? 1.0,
        JSON.stringify(opts.metadata ?? {}),
      ],
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

    const endedClause =
      status === 'COMPLETED' || status === 'FAILED' || status === 'RESET'
        ? `, ended_at = NOW()`
        : '';

    const { rows } = await getPool().query(
      `UPDATE fleet.scenario_runs
       SET status = $2${extra}${endedClause}, updated_at = NOW()
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

  async findActiveRun(mode: FleetMode): Promise<ScenarioRun | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.scenario_runs
       WHERE mode = $1 AND status IN ('RUNNING', 'PAUSED')
       ORDER BY started_at DESC
       LIMIT 1`,
      [mode],
    );
    return rows[0] ? mapRunRow(rows[0]) : null;
  }
}

function mapDefinitionRow(row: Record<string, unknown>): ScenarioDefinition {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    description: row['description'] as string | undefined,
    timelineSec: row['timeline_sec'] as number,
    steps: (row['steps'] as ScenarioDefinitionStep[]) ?? [],
    isActive: row['is_active'] as boolean,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

function mapRunRow(row: Record<string, unknown>): ScenarioRun {
  return {
    id: row['id'] as string,
    scenarioId: row['scenario_id'] as string | undefined,
    mode: row['mode'] as FleetMode,
    status: row['status'] as ScenarioRunStatus,
    seed: row['seed'] as number | undefined,
    speedFactor: Number(row['speed_factor'] ?? 1),
    startedAt: row['started_at'] as Date,
    endedAt: row['ended_at'] as Date | undefined,
    cursorTs: row['cursor_ts'] as Date | undefined,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}
