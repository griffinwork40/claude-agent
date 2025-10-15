// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import GmailIntegrationCard from '@/components/dashboard/GmailIntegrationCard';
import { getGmailCredentials } from '@/lib/supabase/gmail-credentials';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = getServerSupabase();
  
  if (!supabase) {
    // If Supabase is not available, redirect to login
    redirect('/login?redirect=/dashboard');
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/dashboard');

  let isGmailConnected = false;
  try {
    const gmailCredentials = await getGmailCredentials(session.user.id);
    isGmailConnected = !!gmailCredentials;
  } catch (error) {
    console.error('Failed to load Gmail credentials', error);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Manage your integrations and track how Enlist coordinates your job search workflow.
      </p>

      <GmailIntegrationCard
        isConnected={isGmailConnected}
        connectUrl="/api/integrations/gmail/start"
        disconnectUrl="/api/integrations/gmail/disconnect"
      />
    </div>
  );
}


