/**
 * File: components/agents/chat/ActivityCard.tsx
 * Purpose: Activity display component extracted from ChatPane.tsx
 */
import { useState } from 'react';
// import { ChevronDown } from 'lucide-react';
import { Activity } from '../types';
import { renderInlineMarkdown } from './markdown-utils';
import { getActivityDisplay } from './activity-display-config';
import { JobResultCard } from './JobResultCard';
import { JobOpportunity } from '@/types';

const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Check if activity result contains job data
 */
function extractJobResults(activity: Activity): JobOpportunity[] | null {
  if (activity.type !== 'tool_result' || !activity.result) return null;

  const candidate = activity.result as unknown;
  const arraysToCheck: unknown[] = [];

  if (Array.isArray(candidate)) {
    arraysToCheck.push(candidate);
  } else if (candidate && typeof candidate === 'object') {
    const resultObj = candidate as Record<string, unknown>;
    const nestedCandidates = [
      resultObj.data,
      resultObj.result,
      resultObj.jobs,
    ];

    for (const nested of nestedCandidates) {
      if (Array.isArray(nested)) {
        arraysToCheck.push(nested);
      } else if (nested && typeof nested === 'object') {
        const nestedObj = nested as Record<string, unknown>;
        if (Array.isArray(nestedObj.jobs)) {
          arraysToCheck.push(nestedObj.jobs);
        }
      }
    }
  }

  for (const maybeJobs of arraysToCheck) {
    if (!Array.isArray(maybeJobs) || maybeJobs.length === 0) continue;

    const firstJob = maybeJobs[0] as Partial<JobOpportunity> & Record<string, unknown>;
    const firstJobRecord = firstJob as Record<string, unknown>;
    const hasValidStructure =
      typeof firstJob?.title === 'string' &&
      typeof firstJob?.company === 'string' &&
      (typeof firstJob?.application_url === 'string' ||
        typeof firstJobRecord['apply_url'] === 'string' ||
        typeof firstJob?.url === 'string');

    if (hasValidStructure) {
      return maybeJobs as JobOpportunity[];
    }
  }

  return null;
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
  
  // Hide noisy activity types that users don't need to see
  if (['tool_params', 'tool_executing'].includes(activity.type)) {
    return null;
  }
  
  // Special handling for text_chunk: render as inline text with markdown support
  if (activity.type === 'text_chunk') {
    return (
      <div className="text-[var(--assistant-text)] text-sm leading-relaxed">
        {renderInlineMarkdown(activity.content || '', `text-chunk-${activity.id}`)}
      </div>
    );
  }
  
  // Special handling for job results: render as job cards
  const jobResults = extractJobResults(activity);

  if (jobResults) {
    const jobs = jobResults;
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-[var(--fg)]/80 mb-2">
          ✅ Found {jobs.length} matches
        </div>
        {jobs.map((job, idx) => (
          <JobResultCard key={job.id || idx} job={job} />
        ))}
      </div>
    );
  }
  
  // Get display configuration for this activity
  const config = getActivityDisplay(activity);
  const title = typeof config.title === 'function' ? config.title(activity) : config.title;
  const hasDetails = activity.params || activity.result;
  const timestamp = ABSOLUTE_TIME_FORMATTER.format(new Date(activity.timestamp));
  
  // For thinking/status types, use even more minimal styling (no icon, smaller font)
  const isSubtle = activity.type === 'thinking' || activity.type === 'status';
  
  // Determine if this activity is in progress
  const hasCompletionState =
    Boolean(activity.completedAt) || typeof activity.success === 'boolean';
  const isInProgress =
    (activity.type === 'tool_start' || activity.type === 'tool_executing') && !hasCompletionState;
  const isThinking = activity.type === 'tool_start' && !hasCompletionState;
  const isExecuting = activity.type === 'tool_executing' && !hasCompletionState;
  
  return (
    <div 
      className={`my-1 py-0.5 animate-fadeIn w-full group ${isInProgress ? 'animate-cardShimmer' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Single line: icon + text + timestamp */}
      <div className={`flex items-center gap-2 ${isInProgress ? 'border-l-2 border-blue-400/60 pl-2 animate-breathe' : ''}`}>
        {/* Icon - use emoji from config, hidden for subtle types */}
        {!isSubtle && (
          <div className={`flex-shrink-0 text-sm ${isThinking ? 'animate-iconPulse' : isExecuting ? 'animate-iconGlow' : ''}`}>
            {config.icon}
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
        
        {/* Success/Failure indicator for tool results */}
        {activity.success !== undefined && (
          <span className={activity.success ? 'text-green-500/60' : 'text-red-400/70'}>
            {activity.success ? '✓' : '✗'}
          </span>
        )}
        
        {/* Timestamp - always visible, right-aligned */}
        <time className="text-[11px] text-[var(--fg)]/40 whitespace-nowrap flex-shrink-0">
          {timestamp}
        </time>
      </div>
      
      {/* Show/Hide details link - only show if expandable and has details */}
      {config.expandable && hasDetails && (
        <div className="ml-5 mt-0.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[var(--fg)]/50 hover:text-[var(--fg)]/70 transition-colors focus:outline-none focus:text-[var(--fg)]/70 flex items-center gap-1 group-hover:text-[var(--fg)]/60"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide details' : 'Show details'}
          >
            <span 
              className={`text-[var(--fg)]/40 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        </div>
      )}
      
      {/* Expandable details - simple indented text, no background */}
      {config.expandable && hasDetails && expanded && (
        <div className="ml-5 mt-1 animate-slideDown">
          <pre className="text-[11px] text-[var(--fg)]/60 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed">
            {JSON.stringify(activity.params || activity.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
