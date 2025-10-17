// components/testing/GmailIntegrationCardTestHarness.tsx
// Purpose: Client-side harness for exercising GmailIntegrationCard behaviors during automated tests.

"use client";

import GmailIntegrationCard from '@/components/dashboard/GmailIntegrationCard';

interface GmailIntegrationCardTestHarnessProps {
  initialConnected: boolean;
}

/**
 * Provides a controlled wrapper around GmailIntegrationCard with deterministic callbacks for testing.
 *
 * @param {GmailIntegrationCardTestHarnessProps} props - Initial connection state for the harness.
 * @returns {JSX.Element} The rendered harness output.
 */
export default function GmailIntegrationCardTestHarness({
  initialConnected
}: GmailIntegrationCardTestHarnessProps): JSX.Element {
  return (
    <div data-testid="gmail-integration-harness" className="p-6">
      <GmailIntegrationCard
        isConnected={initialConnected}
        connectUrl="/test/connect"
        disconnectUrl="/api/testing/gmail/disconnect"
        onNavigateToConnect={(destination) => {
          document.body.dataset.gmailNavigate = destination;
        }}
        onDisconnected={() => {
          const currentCount = Number(document.body.dataset.gmailDisconnectCount ?? '0');
          document.body.dataset.gmailDisconnectCount = String(currentCount + 1);
        }}
      />
    </div>
  );
}
