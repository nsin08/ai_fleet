// ─── PostgreSQL Adapters ───────────────────────────────────────────────────────
export { getPool, closePool, withTransaction } from './postgres/pool.js';
export { PgVehicleRepository } from './postgres/vehicle.repository.js';
export { PgTelemetryRepository } from './postgres/telemetry.repository.js';
export { PgEventRepository } from './postgres/event.repository.js';
export { PgAlertRepository } from './postgres/alert.repository.js';
export { PgScenarioRepository } from './postgres/scenario.repository.js';

// ─── Ollama Adapter ───────────────────────────────────────────────────────────
export { OllamaAiInferenceAdapter } from './ollama/ollama-ai-inference.adapter.js';

// ─── Clock / RNG ──────────────────────────────────────────────────────────────
export {
  DeterministicClock,
  SeededRng,
  wallClockNow,
} from './clock/deterministic-clock.js';
