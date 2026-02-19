'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import type { ScenarioDefinition, ScenarioRun } from '../../lib/types';
import { API, fetcher, apiPost } from '../../lib/api';

const SWR_OPT = { revalidateOnFocus: false };

export default function ScenariosPage() {
  const { data: scenResp } = useSWR<{ data: ScenarioDefinition[] }>(`${API}/api/scenarios`, fetcher, SWR_OPT);
  const scenarios = scenResp?.data ?? [];

  const [activeRun, setActiveRun] = useState<ScenarioRun | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const run = await apiPost<ScenarioRun>(`/api/scenarios/${id}/run`, { speedFactor: 2 });
      setActiveRun(run);
      void mutate(`${API}/api/fleet/mode`);
    } finally { setLoading(false); }
  }, []);

  const pause = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/pause`);
    setActiveRun(run);
  }, [activeRun]);

  const resume = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/resume`);
    setActiveRun(run);
  }, [activeRun]);

  const reset = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/reset`);
    setActiveRun(run);
    void mutate(`${API}/api/fleet/mode`);
  }, [activeRun]);

  const isRunning = activeRun?.status === 'RUNNING';
  const isPaused = activeRun?.status === 'PAUSED';
  const hasRun = isRunning || isPaused;

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-white">Replay Scenarios</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Deterministic demo playback</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {hasRun && activeRun && (
          <div className={clsx('flex items-center gap-3 p-4 rounded-lg mb-6 ring-1', isRunning ? 'bg-green-950/40 ring-green-800/50' : 'bg-amber-950/40 ring-amber-800/50')}>
            <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', isRunning ? 'bg-green-400 animate-pulse' : 'bg-amber-400')} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">Replay {isRunning ? 'Running' : 'Paused'}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Run ID: {activeRun.id}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isRunning && <button onClick={pause} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium">Pause</button>}
              {isPaused && <button onClick={resume} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium">Resume</button>}
              <button onClick={reset} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium">Reset</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scenarios.length === 0 && <div className="col-span-3 text-center text-slate-600 text-sm py-12">Loading scenarios</div>}
          {scenarios.map((s) => {
            const isActive = activeRun?.scenarioId === s.id;
            return (
              <div key={s.id} className={clsx('flex flex-col rounded-xl border p-5 transition-all', isActive ? 'bg-blue-950/30 border-blue-800/60' : 'bg-[#0c1322] border-slate-800/60 hover:border-slate-700/60')}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{s.id}</div>
                  </div>
                  {isActive && <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0', isRunning ? 'bg-green-900/60 text-green-300' : 'bg-amber-900/60 text-amber-300')}>{activeRun!.status}</span>}
                </div>
                {s.description && <p className="text-[11px] text-slate-500 leading-relaxed mb-4 flex-1">{s.description}</p>}
                <div className="flex items-center gap-3 mb-4 text-[11px] text-slate-600">
                  <span>{(s.steps ?? []).length} steps</span>
                  <span></span>
                  <span>{Math.round((s.timelineSec ?? 0) / 60)} min</span>
                </div>
                {!hasRun ? (
                  <button onClick={() => start(s.id)} disabled={loading} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-semibold transition-colors">
                    {loading ? 'Starting' : ' Start Replay'}
                  </button>
                ) : isActive ? (
                  <div className="text-[11px] text-center text-slate-500">Use controls above</div>
                ) : (
                  <button disabled className="w-full py-2 bg-slate-800 text-slate-600 rounded text-xs font-semibold cursor-not-allowed">Another replay active</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-4 rounded-lg bg-slate-900/40 border border-slate-800/60">
          <div className="text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-400">How replay works:</strong> Scenario steps inject pre-recorded telemetry and events at 2x speed. Alerts fire automatically and appear on the map in real-time. Reset returns the fleet to idle.
          </div>
        </div>
      </div>
    </div>
  );
}
