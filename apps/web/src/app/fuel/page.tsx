'use client';

import { useMemo, useState, useCallback } from 'react';
import clsx from 'clsx';
import useSWR, { mutate } from 'swr';
import { API, fetcher, apiPost } from '../../lib/api';
import type {
  FuelAnomalyListResponse,
  FuelAnomalySeverity,
  FuelAnomalyStatus,
  FuelAnomalySummary,
  Vehicle,
} from '../../lib/types';

type StatusFilter = 'all' | FuelAnomalyStatus;
type SeverityFilter = 'all' | FuelAnomalySeverity;

const STATUS_STYLE: Record<FuelAnomalyStatus, string> = {
  OPEN: 'bg-rose-900/60 text-rose-300',
  CONFIRMED: 'bg-amber-900/60 text-amber-300',
  DISMISSED: 'bg-slate-700 text-slate-300',
  RESOLVED: 'bg-green-900/60 text-green-300',
};

const SEVERITY_STYLE: Record<FuelAnomalySeverity, string> = {
  LOW: 'text-green-300',
  MEDIUM: 'text-amber-300',
  HIGH: 'text-orange-300',
  CRITICAL: 'text-rose-300',
};

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { error?: unknown; requiredPermission?: unknown };
  if (typeof body.error !== 'string') return null;
  if (body.error === 'forbidden' && typeof body.requiredPermission === 'string') {
    return `forbidden (${body.requiredPermission})`;
  }
  return body.error;
}

function fmtTs(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return ts;
  }
}

function fmtNum(value: unknown, digits = 2): string {
  if (value == null) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(digits);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

export default function FuelPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [vehicleId, setVehicleId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', '200');
    if (status !== 'all') q.set('status', status);
    if (severity !== 'all') q.set('severity', severity);
    if (vehicleId !== 'all') q.set('vehicleId', vehicleId);
    return q.toString();
  }, [status, severity, vehicleId]);

  const anomaliesKey = `${API}/api/fuel/anomalies?${query}`;
  const { data, isLoading } = useSWR<FuelAnomalyListResponse>(anomaliesKey, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
  });
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=200`, fetcher, {
    revalidateOnFocus: false,
  });

  const anomalies = data?.data ?? [];
  const stats = data?.stats ?? {
    total: 0,
    open: 0,
    confirmed: 0,
    dismissed: 0,
    resolved: 0,
    highRiskOpen: 0,
  };
  const vehicles = vehiclesResp?.data ?? [];

  const selected: FuelAnomalySummary | null =
    anomalies.find((item) => item.id === selectedId) ?? anomalies[0] ?? null;

  const disposition = useCallback(
    async (nextStatus: 'CONFIRMED' | 'DISMISSED' | 'RESOLVED') => {
      if (!selected) return;
      setActionError(null);
      setLoading(true);
      try {
        const payload = await apiPost(`/api/fuel/anomalies/${selected.id}/disposition`, {
          status: nextStatus,
          note: note.trim() || undefined,
        });
        const error = getApiError(payload);
        if (error) {
          setActionError(error);
          return;
        }
        setNote('');
        await mutate(anomaliesKey);
      } finally {
        setLoading(false);
      }
    },
    [selected, note, anomaliesKey],
  );

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Fuel Anomalies</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Evidence-backed anomaly queue with operator disposition workflow</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <div>Open: <span className="text-rose-300">{stats.open}</span></div>
          <div>High risk open: <span className="text-orange-300">{stats.highRiskOpen}</span></div>
          <div>Total: <span className="text-slate-300">{stats.total}</span></div>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-2 flex-wrap">
        {(['all', 'OPEN', 'CONFIRMED', 'DISMISSED', 'RESOLVED'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium',
              status === item ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
            )}
          >
            {item}
          </button>
        ))}
        <span className="mx-1 text-slate-700">|</span>
        {(['all', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSeverity(item)}
            className={clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium',
              severity === item ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
            )}
          >
            {item}
          </button>
        ))}
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="all">All vehicles</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.vehicleRegNo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-h-0 overflow-auto border-r border-slate-800/60">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0c1322] border-b border-slate-800/60">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Anomaly</th>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Trip</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Fuel Delta %</th>
                <th className="px-4 py-2 text-left">Est. Liters</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {anomalies.map((anomaly) => (
                <tr
                  key={anomaly.id}
                  onClick={() => setSelectedId(anomaly.id)}
                  className={clsx(
                    'cursor-pointer hover:bg-slate-800/20',
                    selected?.id === anomaly.id && 'bg-blue-950/30',
                  )}
                >
                  <td className="px-4 py-2 text-slate-300 font-mono">{anomaly.id}</td>
                  <td className="px-4 py-2 text-white">{anomaly.vehicleRegNo ?? anomaly.vehicleId}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono">{anomaly.tripId ?? '-'}</td>
                  <td className={clsx('px-4 py-2 font-semibold', SEVERITY_STYLE[anomaly.severity])}>{anomaly.severity}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNum(anomaly.fuelDeltaPct)}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNum(anomaly.estimatedLiters)}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNum(anomaly.anomalyScore, 0)}</td>
                  <td className="px-4 py-2">
                    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[anomaly.status])}>
                      {anomaly.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{fmtTs(anomaly.ts)}</td>
                </tr>
              ))}
              {!isLoading && anomalies.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={9}>No anomalies for selected filters.</td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={9}>Loading anomalies...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="w-[420px] bg-[#0c1322] p-4 space-y-4 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Anomaly Detail</div>
          {!selected ? (
            <div className="text-[11px] text-slate-600">Select an anomaly to review evidence and disposition.</div>
          ) : (
            <>
              <div className="space-y-1 text-[11px]">
                <div className="text-slate-200 font-mono">{selected.id}</div>
                <div className="text-slate-500">Vehicle: <span className="text-slate-300">{selected.vehicleRegNo ?? selected.vehicleId}</span></div>
                <div className="text-slate-500">Depot: <span className="text-slate-300">{selected.depotName ?? selected.depotId ?? '-'}</span></div>
                <div className="text-slate-500">Trip: <span className="text-slate-300 font-mono">{selected.tripId ?? '-'}</span></div>
                <div className="text-slate-500">Detected: <span className="text-slate-300">{fmtTs(selected.ts)}</span></div>
                <div className="text-slate-500">Status: <span className="text-slate-300">{selected.status}</span></div>
                <div className="text-slate-500">Fuel delta: <span className="text-slate-300">{fmtNum(selected.fuelDeltaPct)}%</span></div>
                <div className="text-slate-500">Estimated liters: <span className="text-slate-300">{fmtNum(selected.estimatedLiters)} L</span></div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Evidence</div>
                <pre className="max-h-52 overflow-auto rounded border border-slate-800 bg-slate-900/60 p-2 text-[10px] text-slate-300">{safeJson(selected.evidence)}</pre>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Disposition Note</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Add reviewer note (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 resize-none"
                />
                {actionError && <div className="text-[11px] text-rose-300">{actionError}</div>}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => disposition('CONFIRMED')}
                    disabled={loading || selected.status === 'RESOLVED'}
                    className="py-1.5 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => disposition('DISMISSED')}
                    disabled={loading || selected.status === 'RESOLVED'}
                    className="py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-white rounded text-[11px]"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => disposition('RESOLVED')}
                    disabled={loading || selected.status !== 'CONFIRMED'}
                    className="py-1.5 bg-green-700/80 hover:bg-green-700 disabled:bg-slate-700 text-white rounded text-[11px]"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-500 border-t border-slate-800/60 pt-3">
                <div>Disposition by: <span className="text-slate-300">{selected.dispositionedBy ?? '-'}</span></div>
                <div>Disposition at: <span className="text-slate-300">{fmtTs(selected.dispositionedAt)}</span></div>
                <div>Last note: <span className="text-slate-300">{selected.dispositionNote ?? '-'}</span></div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
