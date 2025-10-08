// app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { getSiteName, getSiteUrl } from '@/lib/site';
import LogoutButton from '@/components/LogoutButton';
import LayoutWrapper from '@/components/LayoutWrapper';
import { getServerSupabase } from '@/lib/supabase/server';

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <header className="sticky top-0 z-40 bg-[var(--card)] border-b-2 border-[var(--border)] h-16">
          <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
            <Link href="/" className="text-heading text-[var(--fg)]">Enlist</Link>
            <nav className="flex items-center gap-4 text-readable">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/agent" className="hover:underline">Agents</Link>
              <a href="https://docs.example.com" className="hover:underline" target="_blank" rel="noreferrer">Docs</a>
              {session ? (
                <LogoutButton />
              ) : (
                <Link href="/login" className="hover:underline">Log in</Link>
              )}
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