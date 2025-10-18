// components/agents/BrowserPreview.tsx
// React component with noVNC viewer and control buttons for browser automation
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface BrowserPreviewProps {
  sessionId: string;
  vncUrl?: string;
  websocketUrl?: string;
  onTakeControl?: () => void;
  onReleaseControl?: () => void;
  isControlled?: boolean;
  className?: string;
}

interface BrowserEvent {
  type: string;
  sessionId: string;
  data: any;
  timestamp: number;
}

export default function BrowserPreview({
  sessionId,
  vncUrl,
  websocketUrl,
  onTakeControl,
  onReleaseControl,
  isControlled = false,
  className = ''
}: BrowserPreviewProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [events, setEvents] = useState<BrowserEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!websocketUrl || !sessionId) return;

    const ws = new WebSocket(websocketUrl);
    
    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
      
      // Join the session
      ws.send(JSON.stringify({
        type: 'join_session',
        sessionId,
        userId: 'current_user' // This should come from auth context
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data);
        
        if (data.type === 'automation_progress' || data.type === 'action' || data.type === 'error') {
          setEvents(prev => [...prev, data].slice(-50)); // Keep last 50 events
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };

    setWsConnection(ws);

    return () => {
      ws.close();
    };
  }, [websocketUrl, sessionId]);

  // Scroll to bottom of events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleTakeControl = () => {
    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'take_control',
        sessionId
      }));
    }
    onTakeControl?.();
  };

  const handleReleaseControl = () => {
    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'release_control',
        sessionId
      }));
    }
    onReleaseControl?.();
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!vncUrl) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-gray-500 mb-2">🖥️</div>
          <p className="text-gray-600">No VNC session available</p>
          <p className="text-sm text-gray-400">Start a headful browser session to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Control Panel */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-sm text-gray-500">Session: {sessionId}</span>
        </div>
        
        <div className="flex space-x-2">
          {!isControlled ? (
            <Button
              onClick={handleTakeControl}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              🎮 Take Control
            </Button>
          ) : (
            <Button
              onClick={handleReleaseControl}
              size="sm"
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              🤖 Release Control
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* VNC Viewer */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-gray-600">Loading browser view...</p>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={vncUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            title="Browser VNC Viewer"
          />
        </div>

        {/* Activity Feed */}
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <h3 className="font-medium text-gray-900">Activity Feed</h3>
            <p className="text-sm text-gray-500">Real-time browser actions</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {events.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-2xl mb-2">📝</div>
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">Browser actions will appear here</p>
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-xs ${
                    event.type === 'error' 
                      ? 'bg-red-50 border-l-2 border-red-400' 
                      : event.type === 'action'
                      ? 'bg-blue-50 border-l-2 border-blue-400'
                      : 'bg-gray-50 border-l-2 border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">
                      {event.type.replace('_', ' ')}
                    </span>
                    <span className="text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {event.data?.message || event.data?.action || JSON.stringify(event.data)}
                  </div>
                </div>
              ))
            )}
            <div ref={eventsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}