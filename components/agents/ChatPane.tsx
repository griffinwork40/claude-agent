/**
 * File: components/agents/ChatPane.tsx
 * Purpose: Right-pane chat stream and composer using local state only.
 */
'use client';

import { useMemo, useRef, useState, useEffect, ReactNode } from 'react';
import { ChatPaneProps, Activity, Message } from './types';
import { 
  Wrench, 
  FileText, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Brain, 
  Info 
} from 'lucide-react';

interface RenderMessage extends Message {
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

    // Check for headers (# ## ### #### ##### ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements;
      const sizeClasses = {
        1: 'text-2xl font-bold',
        2: 'text-xl font-bold', 
        3: 'text-lg font-semibold',
        4: 'text-base font-semibold',
        5: 'text-sm font-semibold',
        6: 'text-xs font-semibold'
      };
      
      blocks.push(
        <HeaderTag 
          key={`${keyPrefix}-h${level}-${index}`} 
          className={`${sizeClasses[level as keyof typeof sizeClasses]} mt-4 mb-2 first:mt-0`}
        >
          {renderInlineMarkdown(text, `${keyPrefix}-h${level}-${index}`)}
        </HeaderTag>
      );
      index += 1;
      i += 1;
      continue;
    }

    // Check for horizontal rules (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(
        <hr key={`${keyPrefix}-hr-${index}`} className="my-4 border-t border-[var(--border)]" />
      );
      index += 1;
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
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i]) &&
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
 * Get icon and styling for activity type - Cursor-style muted colors
 */
function getActivityIcon(activity: Activity): { Icon: typeof Wrench; color: string } {
  if (activity.type === 'tool_result') {
    if (activity.success === false) {
      return { Icon: XCircle, color: 'text-red-400/70' };
    }
    return { Icon: CheckCircle, color: 'text-green-500/60' };
  }
  
  switch (activity.type) {
    case 'tool_start':
      return { Icon: Wrench, color: 'text-blue-400/60' };
    case 'tool_params':
      return { Icon: FileText, color: 'text-purple-400/60' };
    case 'tool_executing':
      return { Icon: Zap, color: 'text-amber-400/60' };
    case 'thinking':
      return { Icon: Brain, color: 'text-gray-400' };
    case 'status':
      return { Icon: Info, color: 'text-blue-400/60' };
    default:
      return { Icon: Info, color: 'text-gray-400' };
  }
}

/**
 * Get display title for activity
 */
function getActivityTitle(activity: Activity): string {
  switch (activity.type) {
    case 'tool_start':
      return `Starting ${activity.tool?.replace(/_/g, ' ') || 'tool'}`;
    case 'tool_params':
      return `Parameters for ${activity.tool?.replace(/_/g, ' ') || 'tool'}`;
    case 'tool_executing':
      return `Executing ${activity.tool?.replace(/_/g, ' ') || 'tool'}`;
    case 'tool_result':
      return activity.message || `${activity.tool?.replace(/_/g, ' ') || 'Tool'} ${activity.success ? 'completed' : 'failed'}`;
    case 'thinking':
      return activity.content || 'Processing...';
    case 'status':
      return activity.content || 'Status update';
    default:
      return 'Activity';
  }
}

/**
 * Activity card component - Cursor-style lightweight inline display
 * 
 * Design principles:
 * - Borderless, flat design with no card styling
 * - Single line focus: icon + text + timestamp
 * - Muted colors with opacity (never bright)
 * - Progressive disclosure: details on hover/click
 * - Minimal spacing: blends seamlessly with messages
 */
function ActivityCard({ activity }: { activity: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const { Icon, color } = getActivityIcon(activity);
  const title = getActivityTitle(activity);
  const hasDetails = activity.params || activity.result;
  const timestamp = formatAbsoluteTimestamp(activity.timestamp);
  
  // For thinking/status types, use even more minimal styling (no icon, smaller font)
  const isSubtle = activity.type === 'thinking' || activity.type === 'status';
  
  return (
    <div 
      className="my-1 py-0.5 animate-fadeIn w-full"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Single line: icon + text + timestamp */}
      <div className="flex items-center gap-2">
        {/* Icon - 14px, muted with opacity, hidden for subtle types */}
        {!isSubtle && (
          <div className={`flex-shrink-0 ${color}`}>
            <Icon size={14} strokeWidth={1.5} />
          </div>
        )}
        
        {/* Content - truncates with ellipsis if too long */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span 
            className={`${isSubtle ? 'text-[11px]' : 'text-xs'} text-[var(--fg)]/70 truncate block`} 
            title={title}
          >
            {title}
          </span>
          {activity.error && (
            <span className="text-[11px] text-red-400/80 ml-2 truncate">
              {activity.error}
            </span>
          )}
        </div>
        
        {/* Timestamp - always visible, right-aligned */}
        <time className="text-[11px] text-[var(--fg)]/40 whitespace-nowrap flex-shrink-0">
          {timestamp}
        </time>
      </div>
      
      {/* Show/Hide details link - always available so touch users can expand */}
      {hasDetails && (
        <div className="ml-5 mt-0.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[var(--fg)]/50 hover:text-[var(--fg)]/70 transition-colors focus:outline-none focus:text-[var(--fg)]/70"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide details' : 'Show details'}
          >
            {expanded ? '▼ Hide details' : '▶ Show details'}
          </button>
        </div>
      )}
      
      {/* Expandable details - simple indented text, no background */}
      {hasDetails && expanded && (
        <div className="ml-5 mt-1 animate-fadeIn">
          <pre className="text-[11px] text-[var(--fg)]/60 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed">
            {JSON.stringify(activity.params || activity.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Chat pane listing messages for the selected agent and a simple input box.
 */
export function ChatPane({ agent, messages, onSend, onActivity, isMobile = false }: ChatPaneProps) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingStartedAt, setStreamingStartedAt] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(agent?.id ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Reset session when agent changes
  useEffect(() => {
    if (agent?.id !== currentAgentId) {
      console.log('Agent changed, resetting session', { from: currentAgentId, to: agent?.id });
      setCurrentAgentId(agent?.id ?? null);
      setSessionId(null);
      setIsStreaming(false);
      setStreamingMessage('');
      setStreamingStartedAt(null);
      setActivities([]);
    }
  }, [agent?.id, currentAgentId]);

  const visibleMessages = useMemo(() => {
    if (!agent) return [];
    console.log('Filtering messages:', {
      totalMessages: messages.length,
      agentId: agent.id,
      messages: messages.map(m => ({ id: m.id, agentId: m.agentId, role: m.role }))
    });
    const filtered = messages.filter((m) => m.agentId === agent.id);
    console.log('Visible messages after filter:', filtered.length);
    return filtered;
  }, [agent, messages]);

  // Merge messages and activities, sorted by timestamp
  type TimelineItem = (RenderMessage & { itemType: 'message' }) | (Activity & { itemType: 'activity' });
  
  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!agent) return [];
    
    const items: TimelineItem[] = [];
    
    // Add visible messages
    visibleMessages.forEach((message) => {
      items.push({ ...message, itemType: 'message' as const });
    });
    
    // Add activities
    activities.forEach((activity) => {
      items.push({ ...activity, itemType: 'activity' as const });
    });
    
    // Add streaming message if applicable
    if (isStreaming) {
      items.push({
        id: 'streaming',
        agentId: agent.id,
        role: 'assistant',
        content: streamingMessage,
        createdAt: streamingStartedAt ?? new Date().toISOString(),
        isStreaming: true,
        itemType: 'message' as const,
      });
    }
    
    // Sort by timestamp
    items.sort((a, b) => {
      const aTime = new Date(a.itemType === 'message' ? a.createdAt : a.timestamp).getTime();
      const bTime = new Date(b.itemType === 'message' ? b.createdAt : b.timestamp).getTime();
      return aTime - bTime;
    });
    
    console.log('📋 Timeline items:', {
      total: items.length,
      messages: items.filter(i => i.itemType === 'message').length,
      activities: items.filter(i => i.itemType === 'activity').length
    });
    
    return items;
  }, [agent, visibleMessages, activities, isStreaming, streamingMessage, streamingStartedAt]);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineItems]);

  const handleStreamingSend = async (content: string) => {
    if (!agent || isStreaming) return;
    
    console.log('Starting streaming send...', {
      agentId: agent.id,
      content: content.substring(0, 50) + '...',
      sessionId,
      isStreaming
    });
    
    // Add user message to local state immediately
    const userMessageId = `msg-${Date.now()}-user`;
    const userMessage: Message = {
      id: userMessageId,
      agentId: agent.id,
      role: 'user',
      content: content,
      createdAt: new Date().toISOString(),
    };
    
    // Call onSend to add the user message to parent state
    onSend(content, agent.id, userMessage);
    
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
          agentId: agent.id,
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
              console.log(`Event ${eventCount}:`, data.type, data.content?.substring(0, 50) || data.tool || '...');
              
              if (data.type === 'chunk') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'complete') {
                console.log('✓ Stream completed, sessionId:', data.sessionId);
                
                // Clear streaming state - message is already saved to DB by API route
                setStreamingMessage('');
                setSessionId(data.sessionId);
                setIsStreaming(false);
                setStreamingStartedAt(null);
                
                // Reload messages from database to show the complete assistant response
                // This prevents duplicates since we're using the DB as source of truth
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('reload-messages'));
                }
              } else if (data.type === 'error') {
                console.error('❌ Streaming error:', data.error);
                setIsStreaming(false);
                setStreamingMessage('');
                setStreamingStartedAt(null);
              } else if (
                data.type === 'tool_start' || 
                data.type === 'tool_params' || 
                data.type === 'tool_executing' || 
                data.type === 'tool_result' || 
                data.type === 'thinking' ||
                data.type === 'status'
              ) {
                // Store activity locally for inline display
                const activity: Activity = {
                  id: `activity-${Date.now()}-${Math.random()}`,
                  type: data.type,
                  tool: data.tool,
                  toolId: data.toolId,
                  params: data.params,
                  result: data.result,
                  success: data.success,
                  message: data.message,
                  content: data.content,
                  error: data.error,
                  timestamp: new Date().toISOString()
                };
                console.log('📊 Activity created:', {
                  type: activity.type,
                  tool: activity.tool,
                  hasParams: !!activity.params,
                  hasResult: !!activity.result,
                  hasContent: !!activity.content,
                  message: activity.message
                });
                setActivities(prev => [...prev, activity]);
                
                // Also forward to parent if callback exists
                if (onActivity) {
                  onActivity(activity);
                }
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
    <section className={`h-full flex flex-col ${!isMobile ? 'border-l' : ''} border-[var(--border)] bg-[var(--bg)]`}>
      {!isMobile && (
        <header className="px-4 py-3 border-b border-[var(--border)]">
          <div className="text-sm font-medium text-[var(--fg)]">
            {agent ? `Chat — ${agent.name}` : 'Chat — no agent selected'}
          </div>
        </header>
      )}

      <div className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-3'} flex flex-col`}>
        {timelineItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-xl px-4">
              <div className="text-center mb-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-[var(--fg)] mb-2">Welcome!</h2>
                <p className="text-sm text-[var(--fg)]/60">Get started with one of these common tasks</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                {/* Prompt 1: Find me 5 jobs */}
                <button
                  onClick={() => handleStreamingSend("Find me 5 jobs you think I'd like")}
                  disabled={isStreaming}
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
                  onClick={() => handleStreamingSend("Help me update my resume for tech jobs")}
                  disabled={isStreaming}
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
                  onClick={() => handleStreamingSend("Search for remote software engineering positions")}
                  disabled={isStreaming}
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
                  onClick={() => handleStreamingSend("What are the top skills employers are looking for?")}
                  disabled={isStreaming}
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
        ) : (
          <>
            {timelineItems.map((item, index) => {
              // Check if this is an activity or message
              if (item.itemType === 'activity') {
                // Only render activities that have valid content
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
                if (!hasDisplayableContent) {
                  console.warn('Skipping activity with no content:', item);
                  return null;
                }
                return <ActivityCard key={item.id} activity={item} />;
              }
              
              // Otherwise, render as a message
              const message = item as RenderMessage & { itemType: 'message' };
              const previous = timelineItems[index - 1];
              const next = timelineItems[index + 1];
              const isFirstInGroup = !previous || previous.itemType !== 'message' || (previous as any).role !== message.role;
              const isLastInGroup = !next || next.itemType !== 'message' || (next as any).role !== message.role;
              const theme = ROLE_THEMES[message.role];
              const containerDirection = message.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row text-left';
              const roleLabel = message.role === 'user' ? 'You' : message.role === 'assistant' ? (agent?.name ?? 'Assistant') : 'System';
              const timestamp = formatAbsoluteTimestamp(message.createdAt);
              const relative = formatRelativeTimestamp(message.createdAt);
              const timestampLabel = relative ? `${timestamp} · ${relative}` : timestamp;
              const messageKeyPrefix = `${message.id}-${index}`;
              
              // User messages get rounded corners, assistant messages are borderless
              const bubbleClasses = message.role === 'user' 
                ? 'rounded-2xl px-4 py-3' 
                : 'py-2 px-0';

              return (
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
                      {message.isStreaming && (
                        <span className={`ml-1 inline-block align-middle text-sm ${message.role === 'assistant' ? 'text-[var(--assistant-text)]/60' : 'text-white/80'} animate-cursorPulse`}>
                          █
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

      <footer className={`${isMobile ? 'p-4' : 'p-3'} border-t border-[var(--border)] bg-[var(--bg)]`}>
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
            className={`flex-1 resize-none rounded-xl bg-[var(--card)] text-[var(--fg)] placeholder-[var(--timestamp-subtle)] px-4 py-3 ${isMobile ? 'text-base' : 'text-sm'} border border-[var(--border)] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-150`}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!text.trim() || isStreaming) return;
                handleStreamingSend(text.trim());
                setText('');
              }
            }}
          />
          <button
            type="submit"
            disabled={isStreaming}
            className={`self-stretch ${isMobile ? 'px-5 py-3' : 'px-4 py-2.5'} rounded-xl bg-[var(--accent)] hover:bg-blue-700 active:bg-blue-800 text-[var(--accent-foreground)] text-sm font-medium touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150`}
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </form>
      </footer>
    </section>
  );
}


