/**
 * File: components/agents/BrowserPreview.tsx
 * Purpose: Real-time browser preview with noVNC embed, control handoff buttons, and automation event feed.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SessionPreviewDetails } from '@/lib/browser-tools';

interface AutomationEventPayload {
  message?: string;
  action?: string;
  [key: string]: unknown;
}

interface AutomationEventMessage {
  sessionId: string;
  type: string;
  payload: AutomationEventPayload;
  timestamp: string;
}

export interface BrowserPreviewProps {
  sessionId: string;
  initialPreview?: SessionPreviewDetails | null;
}

/**
 * BrowserPreview renders the streaming VNC session and provides manual control toggles.
 */
export function BrowserPreview({ sessionId, initialPreview = null }: BrowserPreviewProps) {
  const [preview, setPreview] = useState<SessionPreviewDetails | null>(initialPreview);
  const [events, setEvents] = useState<AutomationEventMessage[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRequestingControl, setIsRequestingControl] = useState(false);
  const [hasControl, setHasControl] = useState(false);
  const websocketRef = useRef<WebSocket | null>(null);

  const automationWsUrl = useMemo(() => {
    if (!preview) {
      return null;
    }

    const serviceBase = process.env.NEXT_PUBLIC_BROWSER_SERVICE_URL || 'http://localhost:3001';
    const normalized = serviceBase.replace(/^http/, 'ws');
    const token = encodeURIComponent(preview.sessionToken);
    return `${normalized}/ws/automation?sessionId=${encodeURIComponent(sessionId)}&token=${token}`;
  }, [preview, sessionId]);

  const vncViewerUrl = useMemo(() => {
    if (!preview) {
      return null;
    }

    const httpUrl = preview.websocketUrl.replace(/^ws/, 'http');
    const password = encodeURIComponent(preview.password);
    return `${httpUrl}/vnc.html?autoconnect=true&resize=scale&password=${password}`;
  }, [preview]);

  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/browser-session?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        throw new Error('Failed to load session preview');
      }
      const data = await response.json();
      setPreview(data.data?.preview ?? null);
    } catch (error) {
      console.error('Unable to load preview metadata', error);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [sessionId]);

  const handleTakeControl = useCallback(async () => {
    setIsRequestingControl(true);
    try {
      const response = await fetch('/api/browser-session/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok) {
        throw new Error('Failed to take control');
      }
      setHasControl(true);
    } catch (error) {
      console.error('Take control failed', error);
    } finally {
      setIsRequestingControl(false);
    }
  }, [sessionId]);

  const handleReleaseControl = useCallback(async () => {
    setIsRequestingControl(true);
    try {
      const response = await fetch('/api/browser-session/control', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok) {
        throw new Error('Failed to release control');
      }
      setHasControl(false);
    } catch (error) {
      console.error('Release control failed', error);
    } finally {
      setIsRequestingControl(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!preview) {
      fetchPreview();
    }
  }, [preview, fetchPreview]);

  useEffect(() => {
    if (!automationWsUrl) {
      return;
    }

    const ws = new WebSocket(automationWsUrl);
    websocketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as AutomationEventMessage;
        setEvents((prev) => [parsed, ...prev].slice(0, 50));
      } catch (error) {
        console.warn('Failed to parse automation event', error);
      }
    };

    ws.onclose = () => {
      websocketRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [automationWsUrl]);

  useEffect(() => {
    return () => {
      websocketRef.current?.close();
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Live Browser Preview</h2>
          <p className="text-xs text-neutral-500">Session ID: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTakeControl}
            disabled={isRequestingControl || hasControl}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            Take Control
          </button>
          <button
            type="button"
            onClick={handleReleaseControl}
            disabled={isRequestingControl || !hasControl}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Release Control
          </button>
        </div>
      </div>

      <div className="flex h-72 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
        {isLoadingPreview && <span className="text-xs text-neutral-500">Loading preview…</span>}
        {!isLoadingPreview && !preview && (
          <button
            type="button"
            onClick={fetchPreview}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700"
          >
            Enable Preview
          </button>
        )}
        {preview && vncViewerUrl && (
          <iframe
            title="Browser Preview"
            src={vncViewerUrl}
            className="h-full w-full border-0"
            allowFullScreen
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Automation Feed</h3>
        {events.length === 0 && (
          <p className="text-xs text-neutral-500">No events yet. Automation updates will appear here.</p>
        )}
        <ul className="flex flex-col gap-2">
          {events.map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className="rounded-md bg-white p-2 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-800">{event.type}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {event.payload.message && (
                <p className="mt-1 text-neutral-600">{event.payload.message}</p>
              )}
              {event.payload.action && (
                <p className="mt-1 text-neutral-500">Action: {event.payload.action}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
