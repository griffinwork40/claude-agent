// app/layout.tsx
import './globals.css';
import { getSiteName, getSiteUrl } from '@/lib/site';
import LogoutButton from '@/components/LogoutButton';
import LayoutWrapper from '@/components/LayoutWrapper';

const siteName = getSiteName();
const siteUrl = getSiteUrl();

export const metadata = {
  title: siteName,
  description: 'Enlist is your job search agent—scouting roles, tailoring materials, and applying automatically.',
  metadataBase: siteUrl,
  manifest: '/site.webmanifest',
  openGraph: {
    title: siteName,
    description: 'Enlist is your job search agent—scouting roles, tailoring materials, and applying automatically.',
    url: siteUrl,
    siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: 'Enlist is your job search agent—scouting roles, tailoring materials, and applying automatically.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <header className="sticky top-0 z-40 bg-[var(--card)] border-b-2 border-[var(--border)] h-16">
          <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
            <a href="/" className="text-heading text-[var(--fg)]">Enlist</a>
            <nav className="flex items-center gap-4 text-readable">
              <a href="/" className="hover:underline">Home</a>
              <a href="/agent" className="hover:underline">Agents</a>
              <a href="https://docs.example.com" className="hover:underline" target="_blank" rel="noreferrer">Docs</a>
              <LogoutButton />
            </nav>
          </div>
        </header>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}