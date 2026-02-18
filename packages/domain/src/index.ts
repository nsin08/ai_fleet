// ─── Entities ─────────────────────────────────────────────────────────────────
export * from './entities/vehicle.js';
export * from './entities/driver.js';
export * from './entities/depot.js';
export * from './entities/route.js';
export * from './entities/trip.js';
export * from './entities/telemetry-point.js';
export * from './entities/fleet-event.js';
export * from './entities/alert.js';
export * from './entities/scenario-run.js';
export * from './entities/fleet-state.js';

// ─── Inbound Ports ────────────────────────────────────────────────────────────
export * from './ports/inbound/fleet-query.port.js';
export * from './ports/inbound/scenario-command.port.js';
export * from './ports/inbound/telemetry-ingestion.port.js';
export * from './ports/inbound/ai-usecase.port.js';

// ─── Outbound Ports ───────────────────────────────────────────────────────────
export * from './ports/outbound/vehicle-repository.port.js';
export * from './ports/outbound/telemetry-repository.port.js';
export * from './ports/outbound/event-repository.port.js';
export * from './ports/outbound/alert-repository.port.js';
export * from './ports/outbound/scenario-repository.port.js';
export * from './ports/outbound/emitter-registry.port.js';
export * from './ports/outbound/ai-inference.port.js';
export * from './ports/outbound/stream-publisher.port.js';
