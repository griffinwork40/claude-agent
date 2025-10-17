/**
 * File: components/agents/chat/ChatTimeline.tsx
 * Purpose: Message/activity timeline rendering component extracted from ChatPane.tsx
 */
import { useMemo, useRef, useEffect, ReactNode } from 'react';
import { Agent, Activity, Message } from '../types';
import { renderMarkdown } from './markdown-utils';
import { ActivityCard } from './ActivityCard';

interface RenderMessage extends Message {
  isStreaming?: boolean;
}

type TimelineItem = (RenderMessage & { itemType: 'message' }) | (Activity & { itemType: 'activity' });

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
    bubble: 'bg-brand-600 text-white',
    timestamp: 'text-[var(--timestamp-subtle)]',
    badge: 'bg-brand-600/10 text-brand-700',
  },
  assistant: {
    bubble: 'bg-transparent text-[var(--assistant-text)]',
    timestamp: 'text-[var(--timestamp-subtle)]',
    badge: 'bg-[var(--muted)] text-[var(--assistant-text)]',
  },
  system: {
    bubble: 'bg-ink/5 text-ink',
    timestamp: 'text-[var(--timestamp-subtle)]',
    badge: 'bg-ink/10 text-ink',
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

interface ChatTimelineProps {
  agent: Agent | null;
  messages: Message[];
  activities: Activity[];
  timelineItems: TimelineItem[];
  isStreaming: boolean;
  streamingMessage: string;
  streamingStartedAt: string | null;
  isMobile: boolean;
  onSendPrompt: (prompt: string) => void;
}

export function ChatTimeline({
  agent,
  messages,
  activities,
  timelineItems,
  isStreaming,
  streamingMessage,
  streamingStartedAt,
  isMobile,
  onSendPrompt,
}: ChatTimelineProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineItems]);

  if (timelineItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-xl px-4">
          <div className="text-center mb-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-[var(--fg)] mb-2">Welcome!</h2>
            <p className="text-sm text-[var(--fg)]/60">Get started with one of these common tasks</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
            {/* Prompt 1: Find me 5 jobs */}
            <button
              onClick={() => onSendPrompt("Find me 5 jobs you think I'd like")}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] hover:border-brand-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 text-left min-h-[100px]"
              aria-label="Find me 5 jobs you think I'd like"
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:bg-brand-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg)] leading-relaxed">
                  Find me 5 jobs you think I&apos;d like
                </p>
              </div>
            </button>

            {/* Prompt 2: Update resume */}
            <button
              onClick={() => onSendPrompt("Help me update my resume for tech jobs")}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] hover:border-brand-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 text-left min-h-[100px]"
              aria-label="Help me update my resume for tech jobs"
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:bg-brand-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg)] leading-relaxed">
                  Help me update my resume for tech jobs
                </p>
              </div>
            </button>

            {/* Prompt 3: Remote positions */}
            <button
              onClick={() => onSendPrompt("Search for remote software engineering positions")}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] hover:border-brand-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 text-left min-h-[100px]"
              aria-label="Search for remote software engineering positions"
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:bg-brand-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg)] leading-relaxed">
                  Search for remote software engineering positions
                </p>
              </div>
            </button>

            {/* Prompt 4: Top skills */}
            <button
              onClick={() => onSendPrompt("What are the top skills employers are looking for?")}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] hover:border-brand-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 text-left min-h-[100px]"
              aria-label="What are the top skills employers are looking for?"
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:bg-brand-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg)] leading-relaxed">
                  What are the top skills employers are looking for?
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {(() => {
        const renderedItems: ReactNode[] = [];
        let i = 0;
        
        while (i < timelineItems.length) {
          const item = timelineItems[i];
          
          // Render text_chunk activities as assistant messages
          // Each text_chunk contains the complete text up to that point (cumulative)
          if (item.itemType === 'activity' && item.type === 'text_chunk') {
            const textContent = item.content || '';
            const timestamp = formatAbsoluteTimestamp(item.timestamp);
            const relative = formatRelativeTimestamp(item.timestamp);
            const timestampLabel = relative ? `${timestamp} · ${relative}` : timestamp;
            const theme = ROLE_THEMES.assistant;
            
            // Check if this is the first text chunk (no previous text_chunk)
            const prevItem = i > 0 ? timelineItems[i - 1] : null;
            const isFirstInGroup = !prevItem || 
              prevItem.itemType !== 'activity' || 
              (prevItem as Activity).type !== 'text_chunk';
            
            // For consecutive text_chunks, only show the latest one (it contains all previous text)
            const nextItem = i < timelineItems.length - 1 ? timelineItems[i + 1] : null;
            const hasNextTextChunk = nextItem && 
              nextItem.itemType === 'activity' && 
              (nextItem as Activity).type === 'text_chunk';
            
            // Skip this text_chunk if there's a newer one coming
            if (hasNextTextChunk) {
              i++;
              continue;
            }
            
            renderedItems.push(
              <div
                key={`text-chunk-${item.id}`}
                className={`flex gap-2 flex-row text-left ${isFirstInGroup ? 'mt-4' : 'mt-1'} animate-fadeIn`}
              >
                <div className="flex max-w-[90%] flex-col items-start gap-1">
                  {isFirstInGroup && (
                    <div className="flex items-baseline gap-2 justify-start">
                      <span className={`rounded-md px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider ${theme.badge}`}>
                        {agent?.name ?? 'Assistant'}
                      </span>
                      <time className={`text-[0.6875rem] ${theme.timestamp}`}>
                        {timestampLabel}
                      </time>
                    </div>
                  )}
                  <div className="w-full text-left bg-transparent text-[var(--assistant-text)] py-2 px-0">
                    {renderMarkdown(textContent, `text-chunk-${item.id}`)}
                  </div>
                </div>
              </div>
            );
            
            i++; // Move to next item
            continue;
          }
          
          // Regular activity (not text_chunk)
          if (item.itemType === 'activity') {
            const hasDisplayableContent = Boolean(
              item.tool ||
                item.content ||
                item.message ||
                item.params ||
                item.result ||
                item.error ||
                item.type === 'thinking' ||
                item.type === 'status'
            );
            if (hasDisplayableContent) {
              renderedItems.push(<ActivityCard key={item.id} activity={item} />);
            }
            i++;
            continue;
          }
          
          // Regular message
          const message = item as RenderMessage & { itemType: 'message' };
          const previous = timelineItems[i - 1];
          const next = timelineItems[i + 1];
          const isFirstInGroup = !previous || previous.itemType !== 'message' || (previous as any).role !== message.role;
          const isLastInGroup = !next || next.itemType !== 'message' || (next as any).role !== message.role;
          const theme = ROLE_THEMES[message.role];
          const containerDirection = message.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row text-left';
          const roleLabel = message.role === 'user' ? 'You' : message.role === 'assistant' ? (agent?.name ?? 'Assistant') : 'System';
          const timestamp = formatAbsoluteTimestamp(message.createdAt);
          const relative = formatRelativeTimestamp(message.createdAt);
          const timestampLabel = relative ? `${timestamp} · ${relative}` : timestamp;
          const messageKeyPrefix = `${message.id}-${i}`;
          
          // User messages get rounded corners, assistant messages are borderless
          const bubbleClasses = message.role === 'user' 
            ? 'rounded-2xl px-4 py-3' 
            : 'py-2 px-0';

          renderedItems.push(
            <div
              key={`${message.id}-${message.createdAt}`}
              className={`flex gap-2 ${containerDirection} ${isFirstInGroup ? 'mt-4' : 'mt-1'} animate-fadeIn`}
            >
              <div className={`flex ${message.role === 'user' ? 'max-w-[75%]' : 'max-w-[90%]'} flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
                {isFirstInGroup && (
                  <div className={`flex items-baseline gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className={`rounded-md px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider ${theme.badge}`}>
                      {roleLabel}
                    </span>
                    <time className={`text-[0.6875rem] ${theme.timestamp}`} dateTime={new Date(message.createdAt).toISOString()}>
                      {timestampLabel}
                    </time>
                  </div>
                )}
                <div
                  className={`w-full text-left ${theme.bubble} ${bubbleClasses}`}
                >
                  {renderMarkdown(message.content, messageKeyPrefix)}
                  {message.isStreaming && !message.content && (
                    <span className={`inline-block text-sm ${message.role === 'assistant' ? 'text-[var(--assistant-text)]/60' : 'text-white/80'}`}>
                      <span className="animate-ellipsisDot1">.</span>
                      <span className="animate-ellipsisDot2">.</span>
                      <span className="animate-ellipsisDot3">.</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
          
          i++;
        }
        
        return renderedItems;
      })()}
      <div ref={endRef} />
    </>
  );
}
