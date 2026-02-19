'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: '/dispatch',
    label: 'Dispatch',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/drivers',
    label: 'Drivers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0m8 0a4 4 0 01-8 0m8 0v1a2 2 0 002 2h1m-11-3v1a2 2 0 01-2 2H5m7-10a4 4 0 110-8 4 4 0 010 8z" />
      </svg>
    ),
  },
  {
    href: '/maintenance',
    label: 'Maintenance',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.983 5.5l1.517-1.517a2.121 2.121 0 113 3L15 8.5l-3.017-3zM13.5 10L7 16.5V19h2.5L16 12.5M5 21h14" />
      </svg>
    ),
  },
  {
    href: '/fuel',
    label: 'Fuel',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h-1a2 2 0 00-2 2v14a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2h-1V8h1a2 2 0 002-2V5a2 2 0 00-2-2zM7 6h4v14H7a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    href: '/costs',
    label: 'Costs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-3.314 0-6 1.343-6 3s2.686 3 6 3 6 1.343 6 3-2.686 3-6 3m0-12c3.314 0 6 1.343 6 3m-6-3V4m0 16v-3" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6v-4m4 4V7M5 21h14a1 1 0 001-1V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 12.5l1.5 1.5 3.5-3.5" />
      </svg>
    ),
  },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#0c1322] border-r border-slate-800/60">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight tracking-wide">FleetEdge</div>
              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Operations Console</div>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Menu</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50',
                )}
              >
                {item.icon}
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-300" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-slate-500">All systems nominal</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
