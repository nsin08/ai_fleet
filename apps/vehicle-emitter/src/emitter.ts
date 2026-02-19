import 'dotenv/config';
import { fetch } from 'undici';

/**
 * Vehicle emitter — one container instance per vehicle.
 *
 * Env vars:
 *   VEHICLE_ID        — UUID of the vehicle to emit for (required)
 *   VEHICLE_REG_NO    — Registration number (required)
 *   API_BASE_URL      — Base URL of the ai-fleet API (default: http://api:3001)
 *   EMIT_INTERVAL_MS  — Telemetry emit interval in ms (default: 2000)
 *   START_LAT         — Starting latitude  (default: 28.6)
 *   START_LNG         — Starting longitude (default: 77.2)
 */

const VEHICLE_ID = process.env['VEHICLE_ID'];
const VEHICLE_REG_NO = process.env['VEHICLE_REG_NO'];
const API_BASE_URL = process.env['API_BASE_URL'] ?? 'http://api:3001';
const EMIT_INTERVAL_MS = parseInt(process.env['EMIT_INTERVAL_MS'] ?? '2000', 10);

if (!VEHICLE_ID || !VEHICLE_REG_NO) {
  console.error('[emitter] VEHICLE_ID and VEHICLE_REG_NO are required');
  process.exit(1);
}

// ── Fleet mode guard ────────────────────────────────────────────────────────
// Skip emitting when the fleet is in replay mode — avoids polluting replay data
let fleetMode: 'live' | 'replay' | null = null;
let modeCheckedAt = 0;
let lastModeLog = 0;
const MODE_TTL_MS = 10_000; // re-check every 10 s

async function isLiveMode(): Promise<boolean> {
  const now = Date.now();
  if (fleetMode !== null && now - modeCheckedAt < MODE_TTL_MS) {
    return fleetMode === 'live';
  }
  try {
    const r = await fetch(`${API_BASE_URL}/api/fleet/mode`);
    if (r.ok) {
      const body = (await r.json()) as { mode: string };
      fleetMode = body.mode === 'live' ? 'live' : 'replay';
      modeCheckedAt = now;
    }
  } catch {
    // keep last known value; if unknown, default to emit
  }
  return fleetMode !== 'replay';
}

// ── Mutable vehicle state ───────────────────────────────────────────────────
let lat = parseFloat(process.env['START_LAT'] ?? '28.6');
let lng = parseFloat(process.env['START_LNG'] ?? '77.2');
let speedKph = 0;
let headingDeg = Math.random() * 360;
let odometerKm = 1000;
let fuelPct = 80;
let ignition = true;

// ── State machine ───────────────────────────────────────────────────────────
type DrivePhase = 'idle' | 'accel' | 'cruise' | 'decel';
let phase: DrivePhase = 'idle';
let phaseTicks = 0;           // ticks remaining in current phase
let cruiseTarget = 0;         // target speed during cruise

function nextPhase(): void {
  switch (phase) {
    case 'idle':
      // After idling, start accelerating toward a random cruise speed
      phase = 'accel';
      cruiseTarget = 30 + Math.random() * 70;   // 30–100 km/h
      phaseTicks = 8 + Math.floor(Math.random() * 8); // 8–16 ticks to accelerate
      headingDeg = (headingDeg + (Math.random() - 0.5) * 30 + 360) % 360; // new heading
      break;
    case 'accel':
      phase = 'cruise';
      phaseTicks = 10 + Math.floor(Math.random() * 20); // 10–30 ticks cruising
      break;
    case 'cruise':
      // Randomly decide between coasting back to idle or just slowing a bit
      if (Math.random() < 0.3) {
        phase = 'idle';
        phaseTicks = 5 + Math.floor(Math.random() * 10); // 5–15 ticks idle
        ignition = Math.random() > 0.2; // 20% chance engine off
      } else {
        phase = 'decel';
        phaseTicks = 5 + Math.floor(Math.random() * 8);
      }
      break;
    case 'decel':
      phase = 'accel';
      cruiseTarget = 30 + Math.random() * 70;
      phaseTicks = 6 + Math.floor(Math.random() * 10);
      headingDeg = (headingDeg + (Math.random() - 0.5) * 20 + 360) % 360;
      break;
  }
}

// ── Deterministic movement simulation ──────────────────────────────────────
function step(): void {
  if (phaseTicks <= 0) nextPhase();
  phaseTicks--;

  switch (phase) {
    case 'idle':
      // Parked — speed bleeds to zero
      speedKph = Math.max(0, speedKph * 0.5);
      ignition = ignition; // keep current
      break;
    case 'accel':
      speedKph = speedKph + (cruiseTarget - speedKph) * 0.25;
      if (!ignition) ignition = true;
      break;
    case 'cruise':
      // Slight natural variation ±2 km/h
      speedKph = cruiseTarget + (Math.random() - 0.5) * 4;
      speedKph = Math.max(5, speedKph);
      break;
    case 'decel':
      speedKph = Math.max(0, speedKph * 0.8);
      break;
  }

  // Heading drift only while moving
  if (speedKph > 3) {
    headingDeg = (headingDeg + (Math.random() - 0.5) * 5 + 360) % 360; // gentle ±2.5°
  }

  const distKm = (speedKph / 3600) * (EMIT_INTERVAL_MS / 1000);
  const dLat = distKm * Math.cos((headingDeg * Math.PI) / 180) * (1 / 111);
  const dLng = distKm * Math.sin((headingDeg * Math.PI) / 180) * (1 / (111 * Math.cos((lat * Math.PI) / 180)));

  lat += dLat;
  lng += dLng;
  odometerKm += distKm;
  fuelPct = Math.max(0, fuelPct - distKm * 0.008);
}

async function emit(): Promise<void> {
  // Skip when fleet is in replay mode — replay engine owns telemetry then
  if (!await isLiveMode()) {
    const now = Date.now();
    if (now - lastModeLog > 60_000) { // log at most once per minute
      console.log(`[emitter:${VEHICLE_REG_NO}] fleet in replay mode — pausing live emission`);
      lastModeLog = now;
    }
    return;
  }

  step();

  const now = new Date();
  const isIdling = speedKph < 3;

  const point = {
    vehicleId: VEHICLE_ID,
    vehicleRegNo: VEHICLE_REG_NO,
    sourceMode: 'live' as const,
    sourceEmitterId: `emitter-${VEHICLE_REG_NO}`,
    ts: now.toISOString(),
    tsEpochMs: now.getTime(),
    lat,
    lng,
    speedKph: Math.round(speedKph * 10) / 10,
    ignition,
    idling: isIdling,
    fuelPct: Math.round(fuelPct * 10) / 10,
    engineTempC: 80 + Math.random() * 20,
    batteryV: 12 + Math.random() * 2,
    odometerKm: Math.round(odometerKm),
    headingDeg: Math.round(headingDeg) % 360,
    rpm: Math.round(600 + speedKph * 40),
    metadata: {},
  };

  try {
    const resp = await fetch(`${API_BASE_URL}/api/ingest/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: VEHICLE_ID, points: [point] }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[emitter:${VEHICLE_REG_NO}] ingest failed ${resp.status}: ${text}`);
    }
  } catch (err) {
    console.error(`[emitter:${VEHICLE_REG_NO}] network error`, (err as Error).message);
  }
}

console.log(`[emitter] starting for vehicle ${VEHICLE_REG_NO} (${VEHICLE_ID})`);
setInterval(() => void emit(), EMIT_INTERVAL_MS);
