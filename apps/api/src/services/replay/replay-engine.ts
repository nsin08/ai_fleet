import {
  PgTelemetryRepository,
  PgVehicleRepository,
  PgScenarioRepository,
  DeterministicClock,
  SeededRng,
} from '@ai-fleet/adapters';
import type { ScenarioRun, TelemetryPoint } from '@ai-fleet/domain';
import { WsGateway } from '../../ws/ws-gateway.js';
import { RuleEngine } from '../rules/rule-engine.js';

type TelemetryInput = Omit<TelemetryPoint, 'id' | 'tsEpochMs' | 'createdAt'>;

/** Tick interval in wall-clock ms for the replay loop */
const TICK_INTERVAL_MS = 500;

let _instance: ReplayEngine | null = null;

export class ReplayEngine {
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private clock: DeterministicClock | null = null;
  private rng: SeededRng | null = null;
  private currentRun: ScenarioRun | null = null;
  private paused = false;

  static getInstance(): ReplayEngine | null {
    return _instance;
  }

  static init(): ReplayEngine {
    _instance = new ReplayEngine();
    return _instance;
  }

  start(run: ScenarioRun): void {
    this.stop();
    this.currentRun = run;
    this.paused = false;

    const epochMs = run.cursorTs?.getTime() ?? Date.now() - 86_400_000;
    this.clock = new DeterministicClock(epochMs, 1_000 * (run.speedFactor ?? 1));
    this.rng = new SeededRng(run.seed ?? 42);

    this.tickTimer = setInterval(() => {
      if (!this.paused) void this.tick();
    }, TICK_INTERVAL_MS);

    console.log(`[replay-engine] started run ${run.id} speed=${run.speedFactor}`);
  }

  pause(): void {
    this.paused = true;
  }

  resume(run: ScenarioRun): void {
    this.currentRun = run;
    this.paused = false;
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.currentRun = null;
    this.paused = false;
  }

  private async tick(): Promise<void> {
    if (!this.clock || !this.rng || !this.currentRun) return;

    const ts = this.clock.now();
    const vehicleRepo = new PgVehicleRepository();
    const telemetryRepo = new PgTelemetryRepository();
    const gateway = WsGateway.getInstance();
    const ruleEngine = RuleEngine.getInstance();

    const vehicles = await vehicleRepo.list({ limit: 50 });
    if (vehicles.length === 0) return;

    // Build telemetry points — omit `id` (SERIAL), `tsEpochMs` (generated), `createdAt` (DB default)
    const points: TelemetryInput[] = vehicles.map((v) => {
      const baseLat = 28.6 + this.rng!.nextFloat(-0.5, 0.5);
      const baseLng = 77.2 + this.rng!.nextFloat(-0.5, 0.5);
      const speed = this.rng!.nextFloat(0, 80);
      const isIdling = speed < 3;

      return {
        vehicleId: v.id,
        vehicleRegNo: v.vehicleRegNo,
        tripId: undefined,
        scenarioRunId: this.currentRun!.id,
        sourceMode: 'replay' as const,
        sourceEmitterId: 'replay-engine',
        ts,
        lat: baseLat,
        lng: baseLng,
        speedKph: speed,
        ignition: true,
        idling: isIdling,
        fuelPct: this.rng!.nextFloat(10, 100),
        engineTempC: this.rng!.nextFloat(70, 105),
        batteryV: this.rng!.nextFloat(11.5, 14.5),
        odometerKm: this.rng!.nextFloat(1000, 200_000),
        headingDeg: this.rng!.nextInt(0, 359),
        rpm: this.rng!.nextInt(600, 4500),
        metadata: {},
      };
    });

    const savedPoints = await telemetryRepo.appendMany(points);

    if (gateway) {
      for (const point of savedPoints) {
        await gateway.publishTelemetry(point.vehicleId, point);
      }
    }

    if (ruleEngine) {
      await ruleEngine.evaluate(savedPoints).catch((err) =>
        console.error('[replay-engine] rule evaluation error', err),
      );
    }

    // Update cursor in DB
    const scenarioRepo = new PgScenarioRepository();
    await scenarioRepo
      .updateRunState(this.currentRun.id, 'RUNNING', ts)
      .catch(() => {/* ignore */});
  }
}
