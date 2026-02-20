'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import useSWR, { mutate } from 'swr';
import { API, fetcher, apiPost } from '../../lib/api';
import type { MaintenancePlanSummary, WorkOrderSummary, Vehicle, WorkOrderStatus, WorkOrderPriority } from '../../lib/types';

const URGENCY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-700 text-slate-300',
  MEDIUM: 'bg-amber-900/60 text-amber-300',
  HIGH: 'bg-orange-900/60 text-orange-300',
  CRITICAL: 'bg-red-900/60 text-red-300',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-rose-900/60 text-rose-300',
  IN_PROGRESS: 'bg-amber-900/60 text-amber-300',
  RESOLVED: 'bg-blue-900/60 text-blue-300',
  CLOSED: 'bg-green-900/60 text-green-300',
};

function fmtTs(ts?: string): string {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString('en-IN'); } catch { return ts; }
}

function fmtDate(ds?: string): string {
  if (!ds) return '-';
  try {
    return new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ds; }
}

function daysClass(days?: number | null): string {
  if (days == null) return 'text-slate-400';
  if (days <= 0)  return 'text-red-400 font-semibold';
  if (days <= 3)  return 'text-orange-400 font-medium';
  if (days <= 7)  return 'text-amber-400';
  return 'text-slate-400';
}

function kmClass(km?: number | null): string {
  if (km == null) return 'text-slate-400';
  if (km <= 0)    return 'text-red-400 font-semibold';
  if (km <= 500)  return 'text-orange-400 font-medium';
  if (km <= 1500) return 'text-amber-400';
  return 'text-slate-400';
}

function getApiError(payload: { error?: string; requiredPermission?: string }): string | null {
  if (!payload.error) return null;
  if (payload.error === 'forbidden' && payload.requiredPermission) {
    return `forbidden (${payload.requiredPermission})`;
  }
  return payload.error;
}

export default function MaintenancePage() {
  const [status, setStatus] = useState<'all' | WorkOrderStatus>('all');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [createVehicleId, setCreateVehicleId] = useState('');
  const [createPriority, setCreatePriority] = useState<WorkOrderPriority>('MEDIUM');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const plansKey = `${API}/api/maintenance/plans?limit=100`;
  const workOrdersQuery = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', '100');
    if (status !== 'all') q.set('status', status);
    return q.toString();
  }, [status]);
  const workOrdersKey = `${API}/api/maintenance/work-orders?${workOrdersQuery}`;

  const { data: plansResp } = useSWR<{ data: MaintenancePlanSummary[] }>(plansKey, fetcher, { refreshInterval: 10000, revalidateOnFocus: false });
  const { data: workOrdersResp } = useSWR<{ data: WorkOrderSummary[] }>(workOrdersKey, fetcher, { refreshInterval: 5000, revalidateOnFocus: false });
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=200`, fetcher, { revalidateOnFocus: false });

  const plans = plansResp?.data ?? [];
  const workOrders = workOrdersResp?.data ?? [];
  const vehicles = vehiclesResp?.data ?? [];
  const selectedWorkOrder = workOrders.find((wo) => wo.id === selectedWorkOrderId) ?? null;

  const refresh = useCallback(() => {
    void mutate(plansKey);
    void mutate(workOrdersKey);
    void mutate(`${API}/api/fleet/inventory`);
    void mutate(`${API}/api/fleet/vehicles?limit=100`);
    void mutate(`${API}/api/fleet/states`);
  }, [plansKey, workOrdersKey]);

  const createWorkOrder = useCallback(async () => {
    if (!createVehicleId || !createTitle.trim()) return;
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost('/api/maintenance/work-orders', {
        vehicleId: createVehicleId,
        priority: createPriority,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
      }) as { error?: string; requiredPermission?: string; id?: string };
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      setCreateTitle('');
      setCreateDescription('');
      refresh();
      if (payload.id) setSelectedWorkOrderId(payload.id);
    } finally {
      setLoading(false);
    }
  }, [createVehicleId, createPriority, createTitle, createDescription, refresh]);

  const transition = useCallback(async (nextStatus: WorkOrderStatus) => {
    if (!selectedWorkOrderId) return;
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/maintenance/work-orders/${selectedWorkOrderId}/transition`, { status: nextStatus }) as { error?: string; requiredPermission?: string };
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      refresh();
    } finally {
      setLoading(false);
    }
  }, [selectedWorkOrderId, refresh]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Maintenance</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">PM due queue and work-order lifecycle control</p>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={clsx(
                'px-2.5 py-1 rounded text-[11px] font-medium',
                status === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] grid grid-cols-5 gap-2">
        <select
          value={createVehicleId}
          onChange={(e) => setCreateVehicleId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="">Vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.vehicleRegNo}</option>
          ))}
        </select>
        <select
          value={createPriority}
          onChange={(e) => setCreatePriority(e.target.value as WorkOrderPriority)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <input
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          placeholder="Work-order title"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          value={createDescription}
          onChange={(e) => setCreateDescription(e.target.value)}
          placeholder="Description (optional)"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <button
          type="button"
          onClick={createWorkOrder}
          disabled={loading || !createVehicleId || !createTitle.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-[11px] font-semibold"
        >
          Create Work Order
        </button>
      </div>

      {actionError && (
        <div className="px-6 py-2 border-b border-slate-800/60 bg-rose-950/20 text-[11px] text-rose-300">
          {actionError}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-h-0 overflow-auto border-r border-slate-800/60">
          <div className="sticky top-0 bg-[#0c1322] border-b border-slate-800/60 px-4 py-2 text-[10px] uppercase text-slate-500 tracking-wider">
            PM Due Queue
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-[#0c1322] border-b border-slate-800/40">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Urgency</th>
                <th className="px-4 py-2 text-left">Days</th>
                <th className="px-4 py-2 text-left">KM Remaining</th>
                <th className="px-4 py-2 text-left">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{plan.vehicleRegNo ?? plan.vehicleId}</td>
                  <td className="px-4 py-2">
                    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', URGENCY_STYLE[plan.urgency ?? 'LOW'] ?? URGENCY_STYLE['LOW'])}>
                      {plan.urgency ?? 'LOW'}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-2', daysClass(plan.daysRemaining))}>
                    {plan.daysRemaining != null
                      ? plan.daysRemaining <= 0
                        ? `${Math.abs(plan.daysRemaining)}d overdue`
                        : `${plan.daysRemaining}d`
                      : '-'}
                  </td>
                  <td className={clsx('px-4 py-2', kmClass(plan.kmRemaining))}>
                    {plan.kmRemaining != null
                      ? plan.kmRemaining <= 0
                        ? `${Math.abs(Number(plan.kmRemaining)).toFixed(0)} km over`
                        : `+${Number(plan.kmRemaining).toFixed(0)} km`
                      : '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{fmtDate(plan.nextDueDate)}</td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={5}>No maintenance plans found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="w-[420px] bg-[#0c1322] overflow-auto p-4 space-y-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Work Orders</div>
          <div className="space-y-2">
            {workOrders.map((wo) => (
              <button
                key={wo.id}
                type="button"
                onClick={() => setSelectedWorkOrderId(wo.id)}
                className={clsx(
                  'w-full text-left rounded border border-slate-800 bg-slate-900/30 px-3 py-2 hover:bg-slate-800/30',
                  selectedWorkOrderId === wo.id && 'bg-blue-950/30 border-blue-900/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 font-mono">{wo.id}</span>
                  <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[wo.status] ?? 'bg-slate-700 text-slate-300')}>
                    {wo.status}
                  </span>
                </div>
                <div className="text-slate-400">{wo.vehicleRegNo ?? wo.vehicleId}</div>
                <div className="text-slate-600 truncate">{wo.title}</div>
              </button>
            ))}
            {workOrders.length === 0 && (
              <div className="text-[11px] text-slate-600">No work orders for selected filter.</div>
            )}
          </div>

          <div className="border-t border-slate-800/60 pt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Work Order Detail</div>
            {!selectedWorkOrder ? (
              <div className="text-[11px] text-slate-600">Select a work order to manage lifecycle.</div>
            ) : (
              <>
                <div className="space-y-1 text-[11px]">
                  <div className="text-slate-300 font-mono">{selectedWorkOrder.id}</div>
                  <div className="text-slate-500">Vehicle: <span className="text-slate-300">{selectedWorkOrder.vehicleRegNo ?? selectedWorkOrder.vehicleId}</span></div>
                  <div className="text-slate-500">Priority: <span className="text-slate-300">{selectedWorkOrder.priority}</span></div>
                  <div className="text-slate-500">Opened: <span className="text-slate-300">{fmtTs(selectedWorkOrder.openedAt)}</span></div>
                </div>
                <div className="text-[11px] text-slate-500">{selectedWorkOrder.description ?? '-'}</div>

                <Link
                  href={`/maintenance/work-orders/${selectedWorkOrder.id}`}
                  className="inline-flex px-2 py-1 rounded bg-blue-700/80 hover:bg-blue-700 text-white text-[11px] font-medium"
                >
                  Open Full Detail
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => transition('IN_PROGRESS')} disabled={loading || selectedWorkOrder.status !== 'OPEN'} className="py-1.5 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-[11px]">Start</button>
                  <button type="button" onClick={() => transition('RESOLVED')} disabled={loading || selectedWorkOrder.status !== 'IN_PROGRESS'} className="py-1.5 bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-[11px]">Resolve</button>
                  <button type="button" onClick={() => transition('CLOSED')} disabled={loading || selectedWorkOrder.status !== 'RESOLVED'} className="col-span-2 py-1.5 bg-green-700/80 hover:bg-green-700 disabled:bg-slate-700 text-white rounded text-[11px]">Close</button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
