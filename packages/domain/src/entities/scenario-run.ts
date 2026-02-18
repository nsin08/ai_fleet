export type ScenarioRunStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'RESET' | 'FAILED';

export type FleetMode = 'replay' | 'live';

export interface ScenarioDefinitionStep {
  readonly scenarioId: string;
  readonly stepNo: number;
  readonly atSec: number;
  readonly action: string;
  readonly data: Record<string, unknown>;
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly timelineSec: number;
  readonly steps: ScenarioDefinitionStep[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ScenarioRun {
  readonly id: string;
  readonly scenarioId?: string;
  readonly mode: FleetMode;
  readonly status: ScenarioRunStatus;
  readonly seed?: number;
  readonly speedFactor: number;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly cursorTs?: Date;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
