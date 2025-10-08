/**
 * File: components/agents/ChatPane.tsx
 * Purpose: Right-pane chat stream and composer using local state only.
 */
'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChatPaneProps } from './types';

/**
 * Chat pane listing messages for the selected agent and a simple input box.
 */
export function ChatPane({ agent, messages, onSend, isMobile = false }: ChatPaneProps) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(() => {
    if (!agent) return [];
    return messages.filter((m) => m.agentId === agent.id);
  }, [agent, messages]);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, streamingMessage]);

  const handleStreamingSend = async (content: string) => {
    if (!agent || isStreaming) return;
    
    console.log('Starting streaming send...', {
      agentId: agent.id,
      content: content.substring(0, 50) + '...',
      sessionId,
      isStreaming
    });
    
    setIsStreaming(true);
    setStreamingMessage('');
    
    try {
      console.log('Sending request to /api/chat...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId: sessionId,
        }),
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('❌ No response body reader available');
        throw new Error('No response body');
      }

      console.log('✓ Starting to read stream...');
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✓ Stream reading completed');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++;
            try {
              const data = JSON.parse(line.slice(6));
              console.log(`Event ${eventCount}:`, data.type, data.content?.substring(0, 50) + '...');
              
              if (data.type === 'chunk') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'complete') {
                console.log('✓ Stream completed, sessionId:', data.sessionId);
                setSessionId(data.sessionId);
                setIsStreaming(false);
                setStreamingMessage('');
                // Trigger a refresh of messages from parent
                onSend(content);
              } else if (data.type === 'error') {
                console.error('❌ Streaming error:', data.error);
                setIsStreaming(false);
                setStreamingMessage('');
              }
            } catch (e) {
              console.error('❌ Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error('❌ Error in streaming:', error);
      if (error instanceof Error) {
        console.error('Streaming error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  return (
    <section className={`h-full flex flex-col ${!isMobile ? 'border-l-2' : ''} border-[var(--border)] bg-[var(--bg)]`}>
      {!isMobile && (
        <header className="px-3 py-2 border-b-2 border-[var(--border)]">
          <div className="text-sm text-[var(--fg)]">
            {agent ? `Chat — ${agent.name}` : 'Chat — no agent selected'}
          </div>
        </header>
      )}

      <div className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-3'} space-y-3`}>
        {visibleMessages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full text-[var(--fg)]/60 text-sm">
            No messages yet. Start a conversation!
          </div>
        ) : (
          <>
            {visibleMessages.map((m) => (
              <div key={m.id} className="text-sm">
                <div className="text-[var(--fg)]/70 mb-1 capitalize">{m.role}</div>
                <div className="rounded-md bg-[var(--card)] border-2 border-[var(--border)] p-3 text-[var(--fg)]">
                  {m.content}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="text-sm">
                <div className="text-[var(--fg)]/70 mb-1 capitalize">assistant</div>
                <div className="rounded-md bg-[var(--card)] border-2 border-[var(--border)] p-3 text-[var(--fg)]">
                  {streamingMessage}
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      <footer className={`${isMobile ? 'p-4' : 'p-3'} border-t-2 border-[var(--border)] bg-[var(--bg)]`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || isStreaming) return;
            handleStreamingSend(text.trim());
            setText('');
          }}
          className="flex items-end gap-2"
        >
          <textarea
            aria-label="Message"
            rows={isMobile ? 3 : 2}
            className={`flex-1 resize-none rounded-md bg-[var(--muted)] text-[var(--fg)] placeholder-black/50 px-3 py-2 ${isMobile ? 'text-base' : 'text-sm'} border-2 border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-blue-600`}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            disabled={isStreaming}
            className={`self-stretch ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} rounded-md bg-[var(--accent)] hover:bg-blue-700 text-[var(--accent-foreground)] text-sm font-medium touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </form>
      </footer>
    </section>
  );
}


