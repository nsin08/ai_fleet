'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'fleetedge2026';

function hasDemoSession(): boolean {
  return document.cookie
    .split(';')
    .some((entry) => entry.trim().startsWith('demo_session=1'));
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasDemoSession()) {
      router.replace('/');
    }
  }, [router]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      setError('Invalid username or password');
      return;
    }

    document.cookie = 'demo_session=1; Max-Age=86400; path=/; SameSite=Lax';
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-[#1c1917] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800/60 bg-[#292524] p-6 shadow-xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">FleetEdge</h1>
          <p className="mt-1 text-sm text-slate-500">Operations Console Login</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#1f1a17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#1f1a17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

