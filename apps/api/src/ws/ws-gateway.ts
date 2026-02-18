import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type {
  StreamPublisherPort,
  TelemetryPoint,
  FleetEvent,
  Alert,
  VehicleLatestState,
  FleetRuntimeState,
  ScenarioRun,
} from '@ai-fleet/domain';

type WsMessage =
  | { type: 'telemetry'; vehicleId: string; data: TelemetryPoint }
  | { type: 'event'; data: FleetEvent }
  | { type: 'alert'; data: Alert }
  | { type: 'vehicleState'; data: VehicleLatestState }
  | { type: 'fleetState'; data: FleetRuntimeState }
  | { type: 'replayStatus'; data: ScenarioRun };

let _instance: WsGateway | null = null;

export class WsGateway implements StreamPublisherPort {
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<WebSocket>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });

    _instance = this;
    console.log('[ws-gateway] listening on /ws');
  }

  static getInstance(): WsGateway | null {
    return _instance;
  }

  private broadcast(msg: WsMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async publishTelemetry(vehicleId: string, point: TelemetryPoint): Promise<void> {
    this.broadcast({ type: 'telemetry', vehicleId, data: point });
  }

  async publishEvent(event: FleetEvent): Promise<void> {
    this.broadcast({ type: 'event', data: event });
  }

  async publishAlert(alert: Alert): Promise<void> {
    this.broadcast({ type: 'alert', data: alert });
  }

  async publishVehicleState(state: VehicleLatestState): Promise<void> {
    this.broadcast({ type: 'vehicleState', data: state });
  }

  async publishFleetState(state: FleetRuntimeState): Promise<void> {
    this.broadcast({ type: 'fleetState', data: state });
  }

  async publishReplayStatus(run: ScenarioRun): Promise<void> {
    this.broadcast({ type: 'replayStatus', data: run });
  }
}
