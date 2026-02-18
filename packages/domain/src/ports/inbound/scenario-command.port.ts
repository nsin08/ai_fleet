import type { ScenarioRun } from '../../entities/scenario-run.js';

export interface RunScenarioCommand {
  scenarioId: string;
  seed?: number;
  speedFactor?: number;
}

export interface ScenarioCommandPort {
  runScenario(cmd: RunScenarioCommand): Promise<ScenarioRun>;
  pauseReplay(runId: string): Promise<ScenarioRun>;
  resumeReplay(runId: string): Promise<ScenarioRun>;
  resetReplay(runId: string): Promise<ScenarioRun>;
  getActiveRun(): Promise<ScenarioRun | null>;
}
