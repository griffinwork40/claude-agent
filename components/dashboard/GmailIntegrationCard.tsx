// components/dashboard/GmailIntegrationCard.tsx
// Purpose: Client-side card that manages Gmail connection actions and reflects current integration status.

"use client";

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface GmailIntegrationCardProps {
  isConnected: boolean;
  connectUrl: string;
  disconnectUrl: string;
  error?: string | null;
  onNavigateToConnect?: (destination: string) => void;
  onDisconnected?: () => void;
}

/**
 * Renders the Gmail integration management card, exposing connect and disconnect actions
 * while surfacing any errors related to the integration state or user-triggered requests.
 *
 * @param {GmailIntegrationCardProps} props - Component props containing integration state and URLs.
 * @returns {JSX.Element} The rendered Gmail integration card.
 */
export default function GmailIntegrationCard({
  isConnected,
  connectUrl,
  disconnectUrl,
  onNavigateToConnect,
  onDisconnected
  error,
}: GmailIntegrationCardProps) {
  const router = useRouter();
  const [connected, setConnected] = useState(isConnected);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const handleConnect = () => {
    setError(null);
    setIsConnecting(true);
    const navigate = onNavigateToConnect ?? ((destination: string) => {
      window.location.href = destination;
    });
    navigate(connectUrl);
  };

  const handleDisconnect = () => {
    setError(null);
    setSuccessMessage(null);
    setActionError(null);
    window.location.href = connectUrl;
  };

  const handleDisconnect = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const response = await fetch(disconnectUrl, { method: 'POST' });
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Failed to disconnect Gmail' }));
          throw new Error(data.error || 'Failed to disconnect Gmail');
        }
        setConnected(false);
        setSuccessMessage('Gmail disconnected successfully.');
        onDisconnected?.();
        router.refresh();
      } catch (disconnectError) {
        const message = disconnectError instanceof Error ? disconnectError.message : 'Failed to disconnect Gmail';
        setActionError(message);
      }
    });
  };

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Gmail Integration</h2>
          <p className="mt-1 text-sm text-gray-600">
            Link your Gmail account to let the agent list recent threads, send follow-up emails, and keep conversations up to date.
          </p>
        </div>
        <span
          className={`text-sm font-medium ${connected ? 'text-green-600' : 'text-gray-500'}`}
        >
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {(actionError ?? error) && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError ?? error}
        </p>
      )}

      {successMessage && (
        <p
          data-testid="gmail-success-alert"
          className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-600"
        >
          {successMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isConnecting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            )}
            <span>{isConnecting ? 'Redirecting…' : 'Connect Gmail'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
