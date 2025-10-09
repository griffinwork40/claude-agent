// app/layout.tsx
import './globals.css';
import { getSiteName, getSiteUrl } from '@/lib/site';
import LayoutWrapper from '@/components/LayoutWrapper';
import { getServerSupabase } from '@/lib/supabase/server';
import HeaderNavigation from '@/components/HeaderNavigation';

const siteName = getSiteName();
const siteUrl = getSiteUrl();

export const metadata = {
  title: siteName,
  description: 'The new way to search for jobs. Save 10+ hours per week with AI-powered job search, tailored applications, and automatic applying.',
  metadataBase: siteUrl,
  manifest: '/site.webmanifest',
  openGraph: {
    title: siteName,
    description: 'The new way to search for jobs. Save 10+ hours per week with AI-powered job search, tailored applications, and automatic applying.',
    url: siteUrl,
    siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: 'The new way to search for jobs. Save 10+ hours per week with AI-powered job search, tailored applications, and automatic applying.',
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
            <a href="/" className="text-heading text-[var(--fg)]">Enlist</a>
            <HeaderNavigation isAuthenticated={Boolean(session)} />
          </div>
        </header>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
