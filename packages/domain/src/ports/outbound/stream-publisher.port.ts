import type { TelemetryPoint } from '../../entities/telemetry-point.js';
import type { FleetEvent } from '../../entities/fleet-event.js';
import type { Alert } from '../../entities/alert.js';
import type { VehicleLatestState, FleetRuntimeState } from '../../entities/fleet-state.js';
import type { ScenarioRun } from '../../entities/scenario-run.js';

export interface StreamPublisherPort {
  publishTelemetry(vehicleId: string, point: TelemetryPoint): Promise<void>;
  publishEvent(event: FleetEvent): Promise<void>;
  publishAlert(alert: Alert): Promise<void>;
  publishVehicleState(state: VehicleLatestState): Promise<void>;
  publishFleetState(state: FleetRuntimeState): Promise<void>;
  publishReplayStatus(run: ScenarioRun): Promise<void>;
}
