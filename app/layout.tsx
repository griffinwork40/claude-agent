// app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { getSiteName, getSiteUrl } from '@/lib/site';
import LayoutWrapper from '@/components/LayoutWrapper';
import { getServerSupabase } from '@/lib/supabase/server';
import HeaderNavigation from '@/components/HeaderNavigation';
import { AuthProvider } from '@/components/AuthProvider';

const inter = Inter({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

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
  let session = null;
  
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } catch (error) {
      console.warn('Failed to get session:', error);
    }
  }
  
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
        <AuthProvider initialSession={session}>
          <header className="sticky top-0 z-40 bg-[var(--card)] border-b border-[var(--border)] h-16">
            <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
              <Link href="/" className="text-heading font-semibold text-[var(--fg)]">Enlist</Link>
              <HeaderNavigation isAuthenticated={Boolean(session)} />
            </div>
          </header>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
