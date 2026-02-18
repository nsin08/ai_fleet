'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import type { Vehicle, TelemetryPoint, Alert } from '../../../lib/types';
import { API, WS_URL, fetcher } from '../../../lib/api';

export default function VehicleDetailPage({
  params,
}: {
  params: { vehicleId: string };
}) {
  const { vehicleId } = params;

  /* ── data fetch ── */
  const { data: vehicleResp } = useSWR<{
    vehicle: Vehicle;
    latestTelemetry: TelemetryPoint[];
    activeAlerts: Alert[];
  }>(`${API}/api/fleet/vehicles/${vehicleId}`, fetcher, {
    refreshInterval: 5000,
  });

  const vehicle = vehicleResp?.vehicle;
  const telemetry = vehicleResp?.latestTelemetry ?? [];
  const openAlerts = vehicleResp?.activeAlerts ?? [];

  /* ── live telemetry from WS ── */
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'telemetry' && msg.vehicleId === vehicleId) {
          setLiveTelemetry(msg.data);
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [vehicleId]);

  /* ── latest point (live or from API) ── */
  const latest = liveTelemetry ?? telemetry[0];

  if (!vehicle) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Loading vehicle…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to Overview
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <h1 className="text-2xl font-bold text-white font-mono">
            {vehicle.vehicleRegNo}
          </h1>
          <span className="text-slate-400">—</span>
          <span className="text-lg text-slate-300">{vehicle.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">
            {vehicle.vehicleType}
          </span>
          <VehicleStatusBadge status={vehicle.status} />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          ID: {vehicle.id} · Depot: {vehicle.depotId}
        </p>
      </div>

      {/* Telemetry Cards */}
      {latest ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <TelemetryCard
            label="Speed"
            value={`${latest.speedKph?.toFixed(0) ?? '—'}`}
            unit="kph"
            warn={latest.speedKph > 80}
          />
          <TelemetryCard
            label="Ignition"
            value={latest.ignition ? 'ON' : 'OFF'}
            color={latest.ignition ? 'green' : 'slate'}
          />
          <TelemetryCard
            label="Idling"
            value={latest.idling ? 'YES' : 'NO'}
            color={latest.idling ? 'yellow' : 'slate'}
          />
          <TelemetryCard
            label="Fuel"
            value={`${latest.fuelPct?.toFixed(1) ?? '—'}`}
            unit="%"
            warn={latest.fuelPct < 20}
          />
          <TelemetryCard
            label="Eng Temp"
            value={`${latest.engineTempC?.toFixed(0) ?? '—'}`}
            unit="°C"
            warn={(latest.engineTempC ?? 0) > 100}
          />
          <TelemetryCard
            label="Battery"
            value={`${latest.batteryV?.toFixed(1) ?? '—'}`}
            unit="V"
            warn={(latest.batteryV ?? 13) < 11.5}
          />
          <TelemetryCard
            label="Odometer"
            value={`${latest.odometerKm?.toFixed(0) ?? '—'}`}
            unit="km"
          />
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-500">
          No telemetry data available. Start a scenario replay to generate data.
        </div>
      )}

      {/* Extra telemetry info */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TelemetryCard
            label="Heading"
            value={`${latest.headingDeg?.toFixed(0) ?? '—'}`}
            unit="°"
          />
          <TelemetryCard
            label="RPM"
            value={`${latest.rpm?.toFixed(0) ?? '—'}`}
          />
          <TelemetryCard
            label="Position"
            value={`${latest.lat?.toFixed(4)}, ${latest.lng?.toFixed(4)}`}
          />
          <TelemetryCard
            label="Source"
            value={latest.sourceMode}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Telemetry History */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold text-blue-300 mb-3">
            Recent Telemetry{' '}
            <span className="text-slate-500 text-sm font-normal">({telemetry.length})</span>
          </h2>
          {telemetry.length === 0 ? (
            <p className="text-slate-500 text-sm">No telemetry records</p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-1 pr-2">Time</th>
                    <th className="pb-1 pr-2">Speed</th>
                    <th className="pb-1 pr-2">Fuel</th>
                    <th className="pb-1 pr-2">Eng°C</th>
                    <th className="pb-1 pr-2">Ign</th>
                    <th className="pb-1">Idle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {telemetry.map((t, i) => (
                    <tr key={i} className="text-slate-300">
                      <td className="py-1 pr-2 font-mono">
                        {new Date(t.ts).toLocaleTimeString()}
                      </td>
                      <td className="py-1 pr-2">{t.speedKph?.toFixed(0)} kph</td>
                      <td className="py-1 pr-2">{t.fuelPct?.toFixed(1)}%</td>
                      <td className="py-1 pr-2">{t.engineTempC?.toFixed(0) ?? '—'}°C</td>
                      <td className="py-1 pr-2">{t.ignition ? '✓' : '✗'}</td>
                      <td className="py-1">{t.idling ? '⏳' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Open Alerts */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold text-red-300 mb-3">
            Open Alerts{' '}
            <span className="text-slate-500 text-sm font-normal">({openAlerts.length})</span>
          </h2>
          {openAlerts.length === 0 ? (
            <p className="text-slate-500 text-sm">No open alerts for this vehicle</p>
          ) : (
            <div className="space-y-3">
              {openAlerts.map((a) => (
                <div
                  key={a.id}
                  className="bg-slate-700/50 rounded-lg p-3 border border-slate-700"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-red-200">{a.alertType}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-sm text-slate-300">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(a.createdTs).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function TelemetryCard({
  label,
  value,
  unit,
  color,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: 'green' | 'yellow' | 'slate';
  warn?: boolean;
}) {
  const valueColor = warn
    ? 'text-red-400'
    : color === 'green'
      ? 'text-green-400'
      : color === 'yellow'
        ? 'text-yellow-400'
        : 'text-white';
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={clsx('text-lg font-bold', valueColor)}>
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function VehicleStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    on_trip: 'bg-green-800 text-green-200',
    idle: 'bg-blue-900 text-blue-300',
    parked: 'bg-slate-700 text-slate-300',
    maintenance_due: 'bg-orange-900 text-orange-200',
    alerting: 'bg-red-900 text-red-200',
  };
  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded text-xs font-medium',
        config[status] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase();
  const config: Record<string, string> = {
    HIGH: 'bg-red-900 text-red-200',
    MEDIUM: 'bg-orange-900 text-orange-200',
    LOW: 'bg-yellow-900 text-yellow-200',
  };
  return (
    <span
      className={clsx(
        'px-1.5 py-0.5 rounded text-xs font-medium',
        config[s] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {severity}
    </span>
  );
}
