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

// ── Mutable vehicle state ───────────────────────────────────────────────────
let lat = parseFloat(process.env['START_LAT'] ?? '28.6');
let lng = parseFloat(process.env['START_LNG'] ?? '77.2');
let speedKph = 0;
let headingDeg = 0;
let odometerKm = 1000;
let fuelPct = 80;
let ignition = true;

// ── Deterministic-ish movement simulation ──────────────────────────────────
function step(): void {
  // Gradual acceleration / deceleration
  const target = 20 + Math.random() * 60;
  speedKph = speedKph * 0.85 + target * 0.15;
  headingDeg = (headingDeg + (Math.random() - 0.5) * 10 + 360) % 360;

  const distKm = (speedKph / 3600) * (EMIT_INTERVAL_MS / 1000);
  const dLat = distKm * Math.cos((headingDeg * Math.PI) / 180) * (1 / 111);
  const dLng = distKm * Math.sin((headingDeg * Math.PI) / 180) * (1 / (111 * Math.cos((lat * Math.PI) / 180)));

  lat += dLat;
  lng += dLng;
  odometerKm += distKm;
  fuelPct = Math.max(0, fuelPct - distKm * 0.008);
}

async function emit(): Promise<void> {
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
