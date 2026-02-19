import type { Metadata } from 'next';
import './globals.css';
import { NavShell } from '../components/nav-shell';
import { ErrorBoundary } from '../components/error-boundary';

export const metadata: Metadata = {
  title: 'FleetEdge — Operations Console',
  description: 'Real-time fleet tracking, alerts, and AI-powered operations for SMB fleets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#0f172a] text-white antialiased">
        <ErrorBoundary>
          <NavShell>{children}</NavShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
