// app/testing/gmail-integration/page.tsx
// Purpose: Test-only page rendering the Gmail integration harness for Playwright scenarios.

import GmailIntegrationCardTestHarness from '@/components/testing/GmailIntegrationCardTestHarness';

interface GmailIntegrationTestPageProps {
  searchParams?: {
    connected?: string;
  };
}

/**
 * Renders the Gmail integration harness with configurable initial connection status for testing.
 *
 * @param {GmailIntegrationTestPageProps} props - Query parameters that determine the initial connection state.
 * @returns {JSX.Element} The rendered test page.
 */
export default function GmailIntegrationTestPage({
  searchParams
}: GmailIntegrationTestPageProps): JSX.Element {
  const initialConnected = searchParams?.connected === 'true';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <GmailIntegrationCardTestHarness initialConnected={initialConnected} />
    </main>
  );
}
