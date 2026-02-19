'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { API, fetcher } from '../../lib/api';
import type { CostSummary, InventorySnapshot, Vehicle, VehicleCostSummary } from '../../lib/types';

function fmtCurrency(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `INR ${amount.toFixed(2)}`;
}

function fmtNumber(value: unknown, digits = 2): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return amount.toFixed(digits);
}

function fmtPct(value: unknown): string {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return '-';
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtDay(day: unknown): string {
  if (typeof day !== 'string') return '-';
  try {
    return new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return day;
  }
}

function buildInitialFromDate(): string {
  const now = Date.now();
  const fourteenDaysAgo = now - (13 * 24 * 60 * 60 * 1000);
  return new Date(fourteenDaysAgo).toISOString().slice(0, 10);
}

function buildInitialToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CostsPage() {
  const [dateFrom, setDateFrom] = useState(buildInitialFromDate);
  const [dateTo, setDateTo] = useState(buildInitialToDate);
  const [depotId, setDepotId] = useState('all');
  const [vehicleId, setVehicleId] = useState('all');

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    if (depotId !== 'all') q.set('depotId', depotId);
    if (vehicleId !== 'all') q.set('vehicleId', vehicleId);
    return q.toString();
  }, [dateFrom, dateTo, depotId, vehicleId]);

  const summaryKey = `${API}/api/costs/summary?${query}`;
  const byVehicleKey = `${API}/api/costs/by-vehicle?${query}&limit=200`;

  const { data: summary, isLoading: summaryLoading } = useSWR<CostSummary>(summaryKey, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: false,
  });
  const { data: byVehicleResp, isLoading: byVehicleLoading } = useSWR<{ data: VehicleCostSummary[]; total: number }>(
    byVehicleKey,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );

  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=200`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: inventoryResp } = useSWR<InventorySnapshot>(`${API}/api/fleet/inventory`, fetcher, {
    revalidateOnFocus: false,
  });

  const vehicles = vehiclesResp?.data ?? [];
  const depots = inventoryResp?.byDepot ?? [];
  const byVehicle = byVehicleResp?.data ?? [];

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Costs</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Cost-per-km, idle-cost, and vehicle-level cost distribution</p>
        </div>
        <div className="text-[11px] text-slate-500">Rows: <span className="text-slate-300">{byVehicleResp?.total ?? 0}</span></div>
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
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="all">All vehicles</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.vehicleRegNo}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-5 gap-px bg-slate-800/40 border-b border-slate-800/60">
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Total Cost</div>
          <div className="text-xl font-bold text-white mt-0.5">{fmtCurrency(summary?.totalCost)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Total Distance</div>
          <div className="text-xl font-bold text-cyan-300 mt-0.5">{fmtNumber(summary?.totalDistanceKm)} km</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Cost / KM</div>
          <div className="text-xl font-bold text-green-300 mt-0.5">{fmtCurrency(summary?.costPerKm)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Idle Cost</div>
          <div className="text-xl font-bold text-amber-300 mt-0.5">{fmtCurrency(summary?.idleCost)}</div>
        </div>
        <div className="px-6 py-3 bg-[#0c1322]">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Idle Cost Ratio</div>
          <div className="text-xl font-bold text-orange-300 mt-0.5">{fmtPct(summary?.idleCostRatio)}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[420px_1fr]">
        <aside className="border-r border-slate-800/60 bg-[#0c1322] p-4 space-y-3 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cost Mix</div>
          <div className="space-y-2 text-[11px]">
            {[
              ['Fuel', summary?.fuelCost],
              ['Driver', summary?.driverCost],
              ['Toll', summary?.tollCost],
              ['Maintenance', summary?.maintenanceCost],
              ['Other', summary?.otherCost],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2 flex items-center justify-between">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-200 font-semibold">{fmtCurrency(value)}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800/60 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Daily Trend</div>
            <div className="space-y-1">
              {summary?.trend?.length ? (
                summary.trend.map((point) => (
                  <div key={`${point.day}`} className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>{fmtDay(point.day)}</span>
                      <span className="text-slate-300">{fmtCurrency(point.totalCost)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      cost/km {fmtCurrency(point.costPerKm)} | idle {fmtPct(point.idleCostRatio)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-600">No trend data for selected filters.</div>
              )}
            </div>
          </div>
        </aside>

        <div className="min-h-0 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0c1322] border-b border-slate-800/60">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Depot</th>
                <th className="px-4 py-2 text-left">Trip Count</th>
                <th className="px-4 py-2 text-left">Total Cost</th>
                <th className="px-4 py-2 text-left">Distance KM</th>
                <th className="px-4 py-2 text-left">Cost/KM</th>
                <th className="px-4 py-2 text-left">Idle Cost</th>
                <th className="px-4 py-2 text-left">Idle Ratio</th>
                <th className="px-4 py-2 text-left">Fuel</th>
                <th className="px-4 py-2 text-left">Maintenance</th>
                <th className="px-4 py-2 text-left">Last Entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {byVehicle.map((row) => (
                <tr key={row.vehicleId} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-white">
                    <div className="font-semibold">{row.vehicleRegNo}</div>
                    <div className="text-[10px] text-slate-600 uppercase">{row.vehicleType}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{row.depotName ?? row.depotId ?? '-'}</td>
                  <td className="px-4 py-2 text-slate-300">{row.tripCount}</td>
                  <td className="px-4 py-2 text-slate-200 font-semibold">{fmtCurrency(row.totalCost)}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtNumber(row.totalDistanceKm)}</td>
                  <td className="px-4 py-2 text-green-300">{fmtCurrency(row.costPerKm)}</td>
                  <td className="px-4 py-2 text-amber-300">{fmtCurrency(row.idleCost)}</td>
                  <td className={clsx('px-4 py-2', Number(row.idleCostRatio) > 0.2 ? 'text-rose-300' : 'text-slate-300')}>
                    {fmtPct(row.idleCostRatio)}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{fmtCurrency(row.fuelCost)}</td>
                  <td className="px-4 py-2 text-slate-300">{fmtCurrency(row.maintenanceCost)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {row.lastEntryAt ? new Date(row.lastEntryAt).toLocaleString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
              {!byVehicleLoading && byVehicle.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={11}>No cost entries for selected filters.</td>
                </tr>
              )}
              {(summaryLoading || byVehicleLoading) && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={11}>Loading cost metrics...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
