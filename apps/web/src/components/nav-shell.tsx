'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: '📊' },
  { href: '/alerts', label: 'Alerts', icon: '🔔' },
  { href: '/scenarios', label: 'Scenarios', icon: '🎬' },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-blue-400 tracking-tight">AI Fleet</h1>
          <p className="text-xs text-slate-500 mt-0.5">Operations Platform</p>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-900/30 text-blue-300 border-r-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
          v0.1.0 — Demo
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
