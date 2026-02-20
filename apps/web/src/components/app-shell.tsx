'use client';

import { usePathname } from 'next/navigation';
import { NavShell } from './nav-shell';
import { CopilotDrawer } from './copilot-drawer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/login';

  if (isLoginRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <NavShell>{children}</NavShell>
      <CopilotDrawer />
    </>
  );
}

