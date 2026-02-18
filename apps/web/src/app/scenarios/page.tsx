'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import type { ScenarioDefinition, ScenarioRun, FleetMode } from '../../lib/types';
import { API, fetcher, apiPost } from '../../lib/api';

export default function ScenariosPage() {
  const { data: scenariosResp } = useSWR<{ data: ScenarioDefinition[] }>(
    `${API}/api/scenarios`,
    fetcher,
  );
  const { data: fleetMode } = useSWR<FleetMode>(`${API}/api/fleet/mode`, fetcher, {
    refreshInterval: 3000,
  });

  const [activeRun, setActiveRun] = useState<ScenarioRun | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenarios = scenariosResp?.data ?? [];

  const startScenario = useCallback(async (scenarioId: string) => {
    setLoading(scenarioId);
    setError(null);
    try {
      const run = await apiPost<ScenarioRun>(`/api/scenarios/${scenarioId}/run`, {
        speedFactor: 2,
      });
      setActiveRun(run);
      void mutate(`${API}/api/fleet/mode`);
    } catch (e) {
      setError(`Failed to start: ${e}`);
    } finally {
      setLoading(null);
    }
  }, []);

  const pauseRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/pause`);
    setActiveRun(run);
  }, [activeRun]);

  const resumeRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/resume`);
    setActiveRun(run);
  }, [activeRun]);

  const resetRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/reset`);
    setActiveRun(run);
    void mutate(`${API}/api/fleet/mode`);
  }, [activeRun]);

  const isRunning = activeRun?.status === 'RUNNING';
  const isPaused = activeRun?.status === 'PAUSED';

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Scenarios</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage deterministic replay scenarios for demo and testing
        </p>
      </header>

      {/* Current Run Status */}
      {activeRun && (isRunning || isPaused) && (
        <section className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-blue-300">Active Run</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeRun.id}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    isRunning
                      ? 'bg-green-800 text-green-200'
                      : 'bg-yellow-800 text-yellow-200',
                  )}
                >
                  {activeRun.status}
                </span>
                <span className="text-xs text-slate-500">
                  Speed: {activeRun.speedFactor}x
                </span>
                <span className="text-xs text-slate-500">
                  Started: {new Date(activeRun.startedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {isRunning && (
                <button
                  onClick={pauseRun}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm"
                >
                  ⏸ Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={resumeRun}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
                >
                  ▶ Resume
                </button>
              )}
              <button
                onClick={resetRun}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                ⏹ Reset
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">{s.name}</h3>
            {s.description && (
              <p className="text-sm text-slate-400 mt-1">{s.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>
                Duration: <strong className="text-slate-300">{Math.round(s.timelineSec / 60)}m</strong>
              </span>
              <span>
                Steps: <strong className="text-slate-300">{s.steps.length}</strong>
              </span>
            </div>

            {/* Step list */}
            {s.steps.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-500 font-semibold">Steps:</p>
                {s.steps.slice(0, 5).map((step) => (
                  <div
                    key={`${step.scenarioId}-${step.stepNo}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-slate-500 w-8">
                      @{step.atSec}s
                    </span>
                    <span className="text-slate-300">{step.action}</span>
                  </div>
                ))}
                {s.steps.length > 5 && (
                  <p className="text-xs text-slate-500">
                    +{s.steps.length - 5} more steps
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => startScenario(s.id)}
              disabled={loading === s.id || isRunning || isPaused}
              className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading === s.id ? 'Starting…' : '▶ Start Replay'}
            </button>
          </div>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No scenarios available. Seed the database with scenario definitions.
        </div>
      )}

      {/* Fleet mode info */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-slate-300 mb-2">Fleet Runtime State</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Current Mode: </span>
            <span className="text-white capitalize">{fleetMode?.mode ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Active Run: </span>
            <span className="text-white font-mono">
              {fleetMode?.active_run_id?.slice(0, 8) ?? 'none'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Updated: </span>
            <span className="text-white">
              {fleetMode?.updated_at
                ? new Date(fleetMode.updated_at).toLocaleString()
                : '—'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
