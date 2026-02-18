import type { ScenarioRun, ScenarioRunStatus, ScenarioDefinition } from '../../entities/scenario-run.js';
import type { FleetMode } from '../../entities/scenario-run.js';

export interface StartRunOptions {
  scenarioId: string;
  seed?: number;
  speedFactor?: number;
}

export interface ScenarioRepositoryPort {
  findDefinition(scenarioId: string): Promise<ScenarioDefinition | null>;
  listDefinitions(): Promise<ScenarioDefinition[]>;
  startRun(opts: StartRunOptions): Promise<ScenarioRun>;
  updateRunState(
    runId: string,
    status: ScenarioRunStatus,
    cursorTs?: Date,
  ): Promise<ScenarioRun>;
  findRun(runId: string): Promise<ScenarioRun | null>;
  findActiveRun(mode: FleetMode): Promise<ScenarioRun | null>;
}
