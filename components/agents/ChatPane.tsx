/**
 * File: components/agents/ChatPane.tsx
 * Purpose: Right-pane chat stream and composer using local state only.
 */
'use client';

import { useMemo, useRef, useState } from 'react';
import { ChatPaneProps } from './types';

/**
 * Chat pane listing messages for the selected agent and a simple input box.
 */
export function ChatPane({ agent, messages, onSend, isMobile = false }: ChatPaneProps) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(() => {
    if (!agent) return [];
    return messages.filter((m) => m.agentId === agent.id);
  }, [agent, messages]);

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
        {visibleMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--fg)]/60 text-sm">
            No messages yet. Start a conversation!
          </div>
        ) : (
          visibleMessages.map((m) => (
            <div key={m.id} className="text-sm">
              <div className="text-[var(--fg)]/70 mb-1 capitalize">{m.role}</div>
              <div className="rounded-md bg-[var(--card)] border-2 border-[var(--border)] p-3 text-[var(--fg)]">
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <footer className={`${isMobile ? 'p-4' : 'p-3'} border-t-2 border-[var(--border)] bg-[var(--bg)]`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onSend(text.trim());
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
            className={`self-stretch ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} rounded-md bg-[var(--accent)] hover:bg-blue-700 text-[var(--accent-foreground)] text-sm font-medium touch-manipulation`}
          >
            Send
          </button>
        </form>
      </footer>
    </section>
  );
}


