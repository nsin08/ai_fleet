import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Fleet — Operations Platform',
  description: 'Real-time fleet telemetry, alerting, and AI-assisted operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-900 text-white antialiased">{children}</body>
    </html>
  );
}
