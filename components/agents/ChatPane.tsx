/**
 * File: components/agents/ChatPane.tsx
 * Purpose: Right-pane chat stream and composer using local state only.
 */
'use client';

import { useMemo, useRef, useState, useEffect, ReactNode } from 'react';
import { ChatPaneProps } from './types';

interface RenderMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

const ROLE_THEMES = {
  user: {
    bubble: 'bg-brand-600 text-white border-brand-500 shadow-sm',
    timestamp: 'text-white/80',
    badge: 'bg-brand-500 text-white',
    avatar: 'bg-brand-600 text-white',
  },
  assistant: {
    bubble: 'bg-[var(--card)] text-[var(--fg)] border-brand-200 shadow-sm',
    timestamp: 'text-[var(--fg)]/70',
    badge: 'bg-brand-100 text-brand-800',
    avatar: 'bg-brand-100 text-brand-800',
  },
  system: {
    bubble: 'bg-ink text-white border-ink/80 shadow-sm',
    timestamp: 'text-white/80',
    badge: 'bg-ink text-white',
    avatar: 'bg-ink text-white',
  },
} as const;

function formatAbsoluteTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  return ABSOLUTE_TIME_FORMATTER.format(date);
}

function formatRelativeTimestamp(createdAt: string): string | null {
  const date = new Date(createdAt);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, secondsInUnit] of thresholds) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      const value = Math.round(diffSeconds / secondsInUnit);
      return RELATIVE_TIME_FORMATTER.format(value, unit);
    }
  }

  if (Math.abs(diffSeconds) > 10) {
    return RELATIVE_TIME_FORMATTER.format(diffSeconds, 'second');
  }

  return 'just now';
}

function renderInlineSegment(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*|__|\*|`)(.+?)\1/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const marker = match[1];
    const content = match[2];
    const key = `${keyPrefix}-inline-${index}`;

    if (marker === '`') {
      result.push(
        <code
          key={key}
          className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs text-white/90"
        >
          {content}
        </code>
      );
    } else if (marker === '**' || marker === '__') {
      result.push(
        <strong key={key}>
          {renderInlineSegment(content, `${key}-strong`)}
        </strong>
      );
    } else {
      result.push(
        <em key={key}>
          {renderInlineSegment(content, `${key}-em`)}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
    index += 1;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(...renderInlineSegment(text.slice(lastIndex, match.index), `${keyPrefix}-segment-${index}`));
    }

    const label = renderInlineSegment(match[1], `${keyPrefix}-link-${index}-label`);
    const href = match[2];

    result.push(
      <a
        key={`${keyPrefix}-link-${index}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-inherit underline decoration-brand-300 decoration-2 hover:decoration-brand-500"
      >
        {label}
      </a>
    );

    lastIndex = linkPattern.lastIndex;
    index += 1;
  }

  if (lastIndex < text.length) {
    result.push(...renderInlineSegment(text.slice(lastIndex), `${keyPrefix}-segment-${index}`));
  }

  return result;
}

function renderMarkdown(content: string, keyPrefix: string): ReactNode {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  const pushParagraph = (paragraphLines: string[]) => {
    const paragraphText = paragraphLines.join(' ').trim();
    if (!paragraphText) return;
    blocks.push(
      <p key={`${keyPrefix}-p-${index}`} className="m-0">
        {renderInlineMarkdown(paragraphText, `${keyPrefix}-p-${index}`)}
      </p>
    );
    index += 1;
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^(\*|-|\+)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\*|-|\+)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(\*|-|\+)\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`${keyPrefix}-ul-${index}`} className="ml-5 list-disc space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${index}-item-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ul-${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`${keyPrefix}-ol-${index}`} className="ml-5 list-decimal space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${index}-item-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ol-${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(\*|-|\+)\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    pushParagraph(paragraphLines);
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:decoration-brand-500 [&_a]:decoration-2">
      {blocks}
    </div>
  );
}

/**
 * Chat pane listing messages for the selected agent and a simple input box.
 */
export function ChatPane({ agent, messages, onSend, isMobile = false }: ChatPaneProps) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingStartedAt, setStreamingStartedAt] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(() => {
    if (!agent) return [];
    return messages.filter((m) => m.agentId === agent.id);
  }, [agent, messages]);

  const renderedMessages: RenderMessage[] = useMemo(() => {
    if (!agent) return [];
    const baseMessages: RenderMessage[] = visibleMessages.map((message) => ({ ...message }));

    if (isStreaming) {
      baseMessages.push({
        id: 'streaming',
        agentId: agent.id,
        role: 'assistant',
        content: streamingMessage,
        createdAt: streamingStartedAt ?? new Date().toISOString(),
        isStreaming: true,
      });
    }

    return baseMessages;
  }, [agent, visibleMessages, isStreaming, streamingMessage, streamingStartedAt]);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [renderedMessages]);

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
    setStreamingStartedAt(new Date().toISOString());
    
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
                setStreamingStartedAt(null);
                // Trigger a refresh of messages from parent
                onSend(content);
              } else if (data.type === 'error') {
                console.error('❌ Streaming error:', data.error);
                setIsStreaming(false);
                setStreamingMessage('');
                setStreamingStartedAt(null);
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
      setStreamingStartedAt(null);
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

      <div className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-3'} flex flex-col`}>
        {visibleMessages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full text-[var(--fg)]/60 text-sm">
            No messages yet. Start a conversation!
          </div>
        ) : (
          <>
            {renderedMessages.map((message, index) => {
              const previous = renderedMessages[index - 1];
              const next = renderedMessages[index + 1];
              const isFirstInGroup = !previous || previous.role !== message.role;
              const isLastInGroup = !next || next.role !== message.role;
              const theme = ROLE_THEMES[message.role];
              const containerDirection = message.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row text-left';
              const roleLabel = message.role === 'user' ? 'You' : message.role === 'assistant' ? (agent?.name ?? 'Assistant') : 'System';
              const avatarLabel = message.role === 'assistant' ? (agent?.name?.[0]?.toUpperCase() ?? 'A') : message.role === 'user' ? 'Y' : 'S';
              const timestamp = formatAbsoluteTimestamp(message.createdAt);
              const relative = formatRelativeTimestamp(message.createdAt);
              const timestampLabel = relative ? `${timestamp} · ${relative}` : timestamp;
              const messageKeyPrefix = `${message.id}-${index}`;
              const topCornerClass =
                message.role === 'user'
                  ? isFirstInGroup
                    ? 'rounded-tr-2xl'
                    : 'rounded-tr-md'
                  : isFirstInGroup
                    ? 'rounded-tl-2xl'
                    : 'rounded-tl-md';
              const bottomCornerClass =
                message.role === 'user'
                  ? isLastInGroup
                    ? 'rounded-br-2xl'
                    : 'rounded-br-md'
                  : isLastInGroup
                    ? 'rounded-bl-2xl'
                    : 'rounded-bl-md';
              const oppositeCornerClasses =
                message.role === 'user'
                  ? 'rounded-tl-2xl rounded-bl-2xl'
                  : 'rounded-tr-2xl rounded-br-2xl';

              return (
                <div
                  key={`${message.id}-${message.createdAt}`}
                  className={`flex gap-3 ${containerDirection} ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ${theme.avatar} ${isFirstInGroup ? '' : 'invisible'}`}
                    aria-hidden={!isFirstInGroup}
                  >
                    {avatarLabel}
                  </div>
                  <div className={`flex max-w-[min(480px,80%)] flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
                    {isFirstInGroup && (
                      <div className={`flex items-baseline gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${theme.badge}`}>
                          {roleLabel}
                        </span>
                        <time className={`text-xs ${theme.timestamp}`} dateTime={new Date(message.createdAt).toISOString()}>
                          {timestampLabel}
                        </time>
                      </div>
                    )}
                    <div
                      className={`w-full border px-4 py-3 text-left ${theme.bubble} ${oppositeCornerClasses} ${topCornerClass} ${bottomCornerClass}`}
                    >
                      {renderMarkdown(message.content, messageKeyPrefix)}
                      {message.isStreaming && (
                        <span className={`ml-1 inline-block align-middle text-xs ${message.role === 'assistant' ? theme.timestamp : 'text-white/80'} animate-pulse`}>
                          ▋
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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


