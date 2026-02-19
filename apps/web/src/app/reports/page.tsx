'use client';

import { useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { API, fetcher } from '../../lib/api';
import type {
  DailyReportResponse,
  ExceptionReportRow,
  InventorySnapshot,
  UtilizationReportRow,
} from '../../lib/types';

function initialFrom(): string {
  const now = Date.now() - (6 * 24 * 60 * 60 * 1000);
  return new Date(now).toISOString().slice(0, 10);
}

function initialTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtNum(value: unknown, digits = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(digits);
}

function fmtPct(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num.toFixed(2)}%`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const raw = v == null ? '' : String(v);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  if (!csv) return;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [depotId, setDepotId] = useState('all');

  const reportQuery = useMemo(() => {
    const query = new URLSearchParams();
    query.set('dateFrom', dateFrom);
    query.set('dateTo', dateTo);
    if (depotId !== 'all') query.set('depotId', depotId);
    return query.toString();
  }, [dateFrom, dateTo, depotId]);

  const dailyQuery = useMemo(() => {
    const query = new URLSearchParams();
    query.set('date', dateTo);
    if (depotId !== 'all') query.set('depotId', depotId);
    return query.toString();
  }, [dateTo, depotId]);

  const { data: inventory } = useSWR<InventorySnapshot>(`${API}/api/fleet/inventory`, fetcher, { revalidateOnFocus: false });
  const { data: daily, isLoading: dailyLoading } = useSWR<DailyReportResponse>(`${API}/api/reports/daily?${dailyQuery}`, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: false,
  });
  const { data: utilizationResp, isLoading: utilizationLoading } = useSWR<{ data: UtilizationReportRow[]; total: number }>(
    `${API}/api/reports/utilization?${reportQuery}`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );
  const { data: exceptionsResp, isLoading: exceptionsLoading } = useSWR<{ data: ExceptionReportRow[]; total: number }>(
    `${API}/api/reports/exceptions?${reportQuery}&limit=200`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );

  const depots = inventory?.byDepot ?? [];
  const utilization = utilizationResp?.data ?? [];
  const exceptions = exceptionsResp?.data ?? [];
  const metrics = daily?.metrics;

  const exportUtilization = useCallback(() => {
    downloadCsv(
      `utilization-${dateFrom}-to-${dateTo}.csv`,
      utilization.map((row) => ({
        vehicleId: row.vehicleId,
        vehicleRegNo: row.vehicleRegNo,
        vehicleType: row.vehicleType,
        depotName: row.depotName ?? row.depotId ?? '',
        tripCount: row.tripCount,
        distanceKm: row.distanceKm,
        tripHours: row.tripHours,
        utilizationPct: row.utilizationPct,
        avgDistancePerTripKm: row.avgDistancePerTripKm,
        alertCount: row.alertCount,
        highAlertCount: row.highAlertCount,
        exceptionCount: row.exceptionCount,
      })),
    );
  }, [dateFrom, dateTo, utilization]);

  const exportExceptions = useCallback(() => {
    downloadCsv(
      `exceptions-${dateFrom}-to-${dateTo}.csv`,
      exceptions.map((row) => ({
        exceptionId: row.id,
        tripId: row.tripId,
        vehicleRegNo: row.vehicleRegNo ?? row.vehicleId,
        driverName: row.driverName ?? row.driverId ?? '',
        depotName: row.depotName ?? row.depotId ?? '',
        exceptionType: row.exceptionType,
        severity: row.severity,
        status: row.status,
        openedAt: row.openedAt,
        resolvedAt: row.resolvedAt ?? '',
        durationMin: row.durationMin ?? 0,
        title: row.title,
      })),
    );
  }, [dateFrom, dateTo, exceptions]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Reports</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Utilization, delays, alert burden, and maintenance downtime with CSV export</p>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] grid grid-cols-4 gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <select
          value={depotId}
          onChange={(e) => setDepotId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="all">All depots</option>
          {depots.map((depot) => (
            <option key={depot.depotId} value={depot.depotId}>
              {depot.depotName ?? depot.depotId}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-slate-500 flex items-center justify-end">
          Window: <span className="ml-1 text-slate-300">{dateFrom} to {dateTo}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-px bg-slate-800/40 border-b border-slate-800/60">
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Utilization</div>
          <div className="text-xl font-bold text-cyan-300 mt-0.5">{fmtPct(metrics?.utilizationRatePct)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">On-Time Rate</div>
          <div className="text-xl font-bold text-green-300 mt-0.5">{fmtPct(metrics?.onTimeRatePct)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Delay Rate</div>
          <div className="text-xl font-bold text-amber-300 mt-0.5">{fmtPct(metrics?.delayRatePct)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Alert Burden / Vehicle</div>
          <div className={clsx('text-xl font-bold mt-0.5', Number(metrics?.alertBurdenPerVehicle ?? 0) > 1 ? 'text-rose-300' : 'text-slate-200')}>
            {fmtNum(metrics?.alertBurdenPerVehicle, 3)}
          </div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Maintenance Downtime</div>
          <div className="text-xl font-bold text-orange-300 mt-0.5">{fmtNum(metrics?.maintenanceDowntimeHours)} h</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_460px] overflow-hidden">
        <section className="min-h-0 overflow-auto border-r border-slate-800/60">
          <div className="sticky top-0 z-10 px-4 py-2 border-b border-slate-800/60 bg-[#0c1322] flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Vehicle Utilization</div>
            <button
              type="button"
              onClick={exportUtilization}
              disabled={utilization.length === 0}
              className="px-2 py-1 rounded bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-[11px] text-white"
            >
              Export CSV
            </button>
          </div>

          <table className="w-full text-[11px]">
            <thead className="bg-[#0c1322] border-b border-slate-800/60">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Depot</th>
                <th className="px-4 py-2 text-left">Trips</th>
                <th className="px-4 py-2 text-left">KM</th>
                <th className="px-4 py-2 text-left">Hours</th>
                <th className="px-4 py-2 text-left">Util %</th>
                <th className="px-4 py-2 text-left">Alerts</th>
                <th className="px-4 py-2 text-left">Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {utilization.map((row) => (
                <tr key={row.vehicleId} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-white">
                    <div className="font-semibold">{row.vehicleRegNo}</div>
                    <div className="text-[10px] text-slate-600 uppercase">{row.vehicleType}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{row.depotName ?? row.depotId ?? '-'}</td>
                  <td className="px-4 py-2 text-slate-300">{row.tripCount}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNum(row.distanceKm)}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNum(row.tripHours)}</td>
                  <td className={clsx('px-4 py-2', Number(row.utilizationPct) >= 55 ? 'text-green-300' : 'text-amber-300')}>
                    {fmtPct(row.utilizationPct)}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{row.alertCount} / {row.highAlertCount} high</td>
                  <td className="px-4 py-2 text-slate-300">{row.exceptionCount}</td>
                </tr>
              ))}
              {!utilizationLoading && utilization.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={8}>No utilization records for selected window.</td>
                </tr>
              )}
              {(dailyLoading || utilizationLoading) && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={8}>Loading utilization report...</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <aside className="min-h-0 overflow-auto bg-[#0c1322]">
          <div className="sticky top-0 z-10 px-4 py-2 border-b border-slate-800/60 bg-[#0c1322] flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Exceptions</div>
            <button
              type="button"
              onClick={exportExceptions}
              disabled={exceptions.length === 0}
              className="px-2 py-1 rounded bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-[11px] text-white"
            >
              Export CSV
            </button>
          </div>

          <div className="divide-y divide-slate-800/40">
            {exceptions.map((row) => (
              <div key={row.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-slate-200 font-medium truncate">{row.title}</div>
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                    row.status === 'RESOLVED' ? 'bg-green-900/60 text-green-300' : row.status === 'ACK' ? 'bg-amber-900/60 text-amber-300' : 'bg-rose-900/60 text-rose-300',
                  )}>
                    {row.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{row.vehicleRegNo ?? row.vehicleId} | {row.driverName ?? row.driverId ?? '-'}</div>
                <div className="text-[11px] text-slate-500">{row.exceptionType} | {row.severity} | {fmtNum(row.durationMin, 1)} min</div>
                <div className="text-[10px] text-slate-600">{new Date(row.openedAt).toLocaleString('en-IN')}</div>
              </div>
            ))}
            {!exceptionsLoading && exceptions.length === 0 && (
              <div className="px-4 py-8 text-[11px] text-slate-600">No exceptions in selected window.</div>
            )}
            {exceptionsLoading && (
              <div className="px-4 py-8 text-[11px] text-slate-600">Loading exception report...</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
