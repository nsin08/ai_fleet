'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import useSWR, { mutate } from 'swr';
import { API, fetcher, apiPost } from '../../../../lib/api';
import type { WorkOrderDetail, WorkOrderStatus } from '../../../../lib/types';

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

function getApiError(payload: { error?: string; requiredPermission?: string }): string | null {
  if (!payload.error) return null;
  if (payload.error === 'forbidden' && payload.requiredPermission) {
    return `forbidden (${payload.requiredPermission})`;
  }
  return payload.error;
}

export default function WorkOrderDetailPage({ params }: { params: { workOrderId: string } }) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const workOrderKey = `${API}/api/maintenance/work-orders/${params.workOrderId}`;
  const { data } = useSWR<WorkOrderDetail | { error?: string }>(workOrderKey, fetcher, { refreshInterval: 5000, revalidateOnFocus: false });

  const transition = useCallback(async (status: WorkOrderStatus) => {
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/maintenance/work-orders/${params.workOrderId}/transition`, {
        status,
        resolutionNote: resolutionNote.trim() || undefined,
      }) as { error?: string; requiredPermission?: string };
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      void mutate(workOrderKey);
      void mutate(`${API}/api/maintenance/work-orders?limit=100`);
      void mutate(`${API}/api/fleet/inventory`);
      void mutate(`${API}/api/fleet/vehicles?limit=100`);
      void mutate(`${API}/api/fleet/states`);
    } finally {
      setLoading(false);
    }
  }, [params.workOrderId, resolutionNote, workOrderKey]);

  if (!data) {
    return <div className="h-full bg-[#0f172a] text-slate-500 p-6 text-sm">Loading work order...</div>;
  }
  if ('error' in data && data.error) {
    return (
      <div className="h-full bg-[#0f172a] p-6 space-y-2">
        <Link href="/maintenance" className="text-xs text-blue-400 hover:text-blue-300">Back to Maintenance</Link>
        <div className="text-sm text-rose-300">{data.error}</div>
      </div>
    );
  }

  const workOrder = data as WorkOrderDetail;

  return (
    <div className="h-full overflow-auto bg-[#0f172a]">
      <div className="px-6 py-4 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-3">
        <Link href="/maintenance" className="text-xs text-blue-400 hover:text-blue-300">Back to Maintenance</Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-sm text-white font-semibold font-mono">{workOrder.id}</h1>
        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[workOrder.status] ?? 'bg-slate-700 text-slate-300')}>
          {workOrder.status}
        </span>
      </div>

      <div className="p-6 space-y-4">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Vehicle</div>
            <div className="text-slate-200">{workOrder.vehicleRegNo ?? workOrder.vehicleId}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Priority</div>
            <div className="text-slate-200">{workOrder.priority}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Opened</div>
            <div className="text-slate-200">{fmtTs(workOrder.openedAt)}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Assigned To</div>
            <div className="text-slate-200">{workOrder.assignedTo ?? '-'}</div>
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322] p-3 text-[11px]">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Title</div>
          <div className="text-slate-200">{workOrder.title}</div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mt-3 mb-1">Description</div>
          <div className="text-slate-300">{workOrder.description ?? '-'}</div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mt-3 mb-1">Resolution Note</div>
          <div className="text-slate-300">{workOrder.resolutionNote ?? '-'}</div>
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322] p-3 space-y-2">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider">Lifecycle Actions</div>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={3}
            placeholder="Resolution note (optional)"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 resize-none"
          />
          {actionError && <div className="text-[11px] text-rose-300">{actionError}</div>}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => transition('IN_PROGRESS')} disabled={loading || workOrder.status !== 'OPEN'} className="py-1.5 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-[11px]">Start</button>
            <button type="button" onClick={() => transition('RESOLVED')} disabled={loading || workOrder.status !== 'IN_PROGRESS'} className="py-1.5 bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-[11px]">Resolve</button>
            <button type="button" onClick={() => transition('CLOSED')} disabled={loading || workOrder.status !== 'RESOLVED'} className="py-1.5 bg-green-700/80 hover:bg-green-700 disabled:bg-slate-700 text-white rounded text-[11px]">Close</button>
          </div>
        </section>
      </div>
    </div>
  );
}
