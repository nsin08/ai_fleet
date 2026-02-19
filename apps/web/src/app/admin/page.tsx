'use client';

import { useMemo, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import { API, fetcher, getActiveUserId, setActiveUserId } from '../../lib/api';
import type { AdminUserSummary, AuditLogEntry } from '../../lib/types';

function fmtTs(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return ts;
  }
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { error?: unknown; requiredPermission?: unknown };
  if (typeof body.error !== 'string') return null;
  if (body.error === 'forbidden' && typeof body.requiredPermission === 'string') {
    return `forbidden (${body.requiredPermission})`;
  }
  return body.error;
}

export default function AdminPage() {
  const [candidateUserId, setCandidateUserId] = useState(() => getActiveUserId());
  const [activeUserId, setActiveUserIdState] = useState(() => getActiveUserId());
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const usersKey = `${API}/api/admin/users`;
  const { data: usersResp } = useSWR<{ data: AdminUserSummary[]; total: number } | { error?: string }>(
    usersKey,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );

  const auditQuery = useMemo(() => {
    const query = new URLSearchParams();
    query.set('limit', '200');
    if (actionFilter.trim()) query.set('action', actionFilter.trim());
    if (entityTypeFilter.trim()) query.set('entityType', entityTypeFilter.trim());
    if (actorFilter.trim()) query.set('actorId', actorFilter.trim());
    return query.toString();
  }, [actionFilter, entityTypeFilter, actorFilter]);

  const auditKey = `${API}/api/admin/audit-logs?${auditQuery}`;
  const { data: auditResp } = useSWR<{ data: AuditLogEntry[]; total: number } | { error?: string }>(
    auditKey,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );

  const users = (usersResp && 'data' in usersResp ? usersResp.data : []) ?? [];
  const auditRows = (auditResp && 'data' in auditResp ? auditResp.data : []) ?? [];
  const usersError = getApiError(usersResp);
  const auditError = getApiError(auditResp);

  const applyActiveUser = useCallback(async () => {
    if (!candidateUserId.trim()) return;
    setActiveUserId(candidateUserId.trim());
    setActiveUserIdState(candidateUserId.trim());
    setNotice(`Active API user set to ${candidateUserId.trim()}`);
    await mutate(usersKey);
    await mutate(auditKey);
  }, [candidateUserId, usersKey, auditKey]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Admin</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">RBAC context switch and audit trail explorer</p>
        </div>
        <div className="text-[11px] text-slate-500">
          Active user: <span className="text-slate-300 font-mono">{activeUserId}</span>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] grid grid-cols-[1fr_200px_200px_140px] gap-2">
        <input
          value={candidateUserId}
          onChange={(e) => setCandidateUserId(e.target.value)}
          placeholder="Set active user id (x-user-id)"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          placeholder="Filter actorId"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter action"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <button
          type="button"
          onClick={applyActiveUser}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold"
        >
          Apply User
        </button>
        <input
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          placeholder="Filter entityType"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 col-span-2"
        />
        <select
          value={candidateUserId}
          onChange={(e) => setCandidateUserId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 col-span-2"
        >
          <option value={candidateUserId}>Quick pick users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName} ({user.id})
            </option>
          ))}
        </select>
      </div>

      {(notice || usersError || auditError) && (
        <div className={clsx(
          'px-6 py-2 border-b border-slate-800/60 text-[11px]',
          usersError || auditError ? 'bg-rose-950/20 text-rose-300' : 'bg-emerald-950/20 text-emerald-300',
        )}>
          {usersError || auditError
            ? `Admin access error: ${usersError ?? auditError}`
            : notice}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[360px_1fr]">
        <aside className="border-r border-slate-800/60 bg-[#0c1322] overflow-auto">
          <div className="sticky top-0 px-4 py-2 bg-[#0c1322] border-b border-slate-800/60 text-[10px] uppercase tracking-wider text-slate-500">
            Users & Roles
          </div>
          <div className="divide-y divide-slate-800/40">
            {users.map((user) => (
              <div key={user.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-slate-200 font-medium">{user.displayName}</div>
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                    user.isActive ? 'bg-green-900/60 text-green-300' : 'bg-slate-800 text-slate-500',
                  )}>
                    {user.isActive ? 'active' : 'inactive'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{user.id}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <span key={`${user.id}-${role.id}`} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                      {role.name}
                    </span>
                  ))}
                  {user.roles.length === 0 && <span className="text-[10px] text-slate-600">No roles</span>}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-4 py-8 text-[11px] text-slate-600">No user records or access denied.</div>
            )}
          </div>
        </aside>

        <section className="overflow-auto">
          <div className="sticky top-0 z-10 px-4 py-2 bg-[#0c1322] border-b border-slate-800/60 text-[10px] uppercase tracking-wider text-slate-500">
            Audit Logs
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-[#0c1322] border-b border-slate-800/60">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Actor</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {auditRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmtTs(row.ts)}</td>
                  <td className="px-4 py-2 text-slate-300 whitespace-nowrap">{row.actorDisplayName ?? row.actorId ?? '-'}</td>
                  <td className="px-4 py-2 text-white font-medium">{row.action}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {row.entityType}
                    {row.entityId ? (
                      <span className="ml-1 text-slate-600 font-mono">{row.entityId}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-slate-500 font-mono max-w-[420px] truncate">{compactJson(row.payload ?? {})}</td>
                </tr>
              ))}
              {auditRows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={5}>No audit rows for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
