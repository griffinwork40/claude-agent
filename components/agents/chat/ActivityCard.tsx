/**
 * File: components/agents/chat/ActivityCard.tsx
 * Purpose: Activity display component extracted from ChatPane.tsx
 */
import { useState } from 'react';
import {
  Wrench,
  FileText,
  Zap,
  CheckCircle,
  XCircle,
  Brain,
  Info,
} from 'lucide-react';
import { Activity } from '../types';
import { renderInlineMarkdown } from './markdown-utils';

const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

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
export function ActivityCard({ activity }: { activity: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);
  
  // Special handling for text_chunk: render as inline text with markdown support
  if (activity.type === 'text_chunk') {
    return (
      <div className="text-[var(--assistant-text)] text-sm leading-relaxed">
        {renderInlineMarkdown(activity.content || '', `text-chunk-${activity.id}`)}
      </div>
    );
  }
  
  const { Icon, color } = getActivityIcon(activity);
  const title = getActivityTitle(activity);
  const hasDetails = activity.params || activity.result;
  const timestamp = ABSOLUTE_TIME_FORMATTER.format(new Date(activity.timestamp));
  
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
          {activity.fallback_url && (
            <a 
              href={activity.fallback_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400/80 ml-2 hover:text-blue-300/90 underline"
            >
              Manual Search →
            </a>
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
