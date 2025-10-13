// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = getServerSupabase();
  
  if (!supabase) {
    // If Supabase is not available, redirect to login
    redirect('/login?redirect=/dashboard');
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/dashboard');

  const { data: gmailCredential, error: gmailError } = await supabase
    .from('gmail_credentials')
    .select('access_token_expires_at, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (gmailError) {
    console.error('Failed to load Gmail credentials', gmailError);
  }

  const isGmailConnected = Boolean(gmailCredential);
  const expiresAt = gmailCredential?.access_token_expires_at
    ? new Date(gmailCredential.access_token_expires_at).toLocaleString()
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your connected services and monitor agent activity.</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gmail integration</h2>
            {isGmailConnected ? (
              <p className="mt-1 text-sm text-gray-600">
                Gmail is connected. Access token {expiresAt ? `expires around ${expiresAt}` : 'has no reported expiration timestamp'}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                Connect Gmail to let the agent read, triage, and respond to messages you approve.
              </p>
            )}
          </div>

          {isGmailConnected ? (
            <form action="/api/integrations/gmail/disconnect" method="post">
              <button
                type="submit"
                className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
              >
                Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/integrations/gmail/start"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Connect Gmail
            </a>
          )}
        </div>
      </section>
    </div>
  );
}


