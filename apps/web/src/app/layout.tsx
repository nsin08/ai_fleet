import type { Metadata } from 'next';
import './globals.css';
import { ErrorBoundary } from '../components/error-boundary';
import { AppShell } from '../components/app-shell';

export const metadata: Metadata = {
  title: 'FleetEdge — Operations Console',
  description: 'Real-time fleet tracking, alerts, and AI-powered operations for SMB fleets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#1c1917] text-slate-100 antialiased">
        <ErrorBoundary>
          <AppShell>{children}</AppShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
