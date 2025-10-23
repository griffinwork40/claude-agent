// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import GmailIntegrationCard from '@/components/dashboard/GmailIntegrationCard';
import ResumeGallery from '@/components/dashboard/ResumeGallery';
import { getGmailCredentials } from '@/lib/supabase/gmail-credentials';

export const dynamic = 'force-dynamic';

/**
 * Server component rendering the main dashboard view, including integration status cards.
 * Ensures the user is authenticated and surfaces Gmail connectivity issues.
 *
 * @returns {Promise<JSX.Element>} The rendered dashboard page.
 */
export default async function DashboardPage() {
  const supabase = getServerSupabase();

  if (!supabase) {
    // If Supabase is not available, redirect to login
    redirect('/login?redirect=/dashboard');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/dashboard');

  let isGmailConnected = false;
  let gmailError: string | null = null;
  try {
    const gmailCredentials = await getGmailCredentials(session.user.id);
    isGmailConnected = !!gmailCredentials;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    gmailError = `We couldn't retrieve your Gmail status: ${message}`;
    console.error('Failed to load Gmail credentials', error);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Manage your integrations and track how Enlist coordinates your job search workflow.
      </p>

      {gmailError && (
        <div className="mt-6 rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-800">
          <p className="font-semibold">We couldn&apos;t check your Gmail status.</p>
          <p className="mt-1">{gmailError}</p>
          <p className="mt-2">Please refresh the page to try again.</p>
        </div>
      )}

      <GmailIntegrationCard
        isConnected={isGmailConnected}
        connectUrl="/api/integrations/gmail/start"
        disconnectUrl="/api/integrations/gmail/disconnect"
        error={gmailError}
      />

      <ResumeGallery />
    </div>
  );
}


