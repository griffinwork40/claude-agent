/**
 * File: components/agents/BrowserPane.tsx
 * Purpose: Middle-pane workspace showing agent activity and context.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserPaneProps, Activity } from './types';

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format timestamp for activity
 */
function formatActivityTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get icon and color for activity type
 */
function getActivityStyle(activity: Activity): { icon: string; color: string; bgColor: string } {
  if (activity.type === 'tool_result') {
    if (activity.success === false) {
      return { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-50' };
    }
    return { icon: '✓', color: 'text-green-600', bgColor: 'bg-green-50' };
  }
  
  switch (activity.type) {
    case 'tool_start':
      return { icon: '🔧', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    case 'tool_params':
      return { icon: '📝', color: 'text-purple-600', bgColor: 'bg-purple-50' };
    case 'tool_executing':
      return { icon: '⚡', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    case 'thinking':
      return { icon: '🤔', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    case 'status':
      return { icon: 'ℹ️', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    default:
      return { icon: '•', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  }
}

/**
 * Get display title for activity
 */
function getActivityTitle(activity: Activity): string {
  switch (activity.type) {
    case 'tool_start':
      return `Starting ${activity.tool || 'tool'}`;
    case 'tool_params':
      return `Parameters for ${activity.tool || 'tool'}`;
    case 'tool_executing':
      return `Executing ${activity.tool || 'tool'}`;
    case 'tool_result':
      return activity.message || `${activity.tool || 'Tool'} ${activity.success ? 'completed' : 'failed'}`;
    case 'thinking':
      return activity.content || 'Processing...';
    case 'status':
      return activity.content || 'Status update';
    default:
      return 'Activity';
  }
}

/**
 * Activity item component
 */
function ActivityItem({ activity, isLatest }: { activity: Activity; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActivityStyle(activity);
  const title = getActivityTitle(activity);
  const hasDetails = activity.params || activity.result;
  
  return (
    <div className={`border-l-2 ${style.color.replace('text-', 'border-')} pl-4 pb-4 relative`}>
      {/* Timeline dot */}
      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${style.bgColor} ${style.color} flex items-center justify-center text-xs`}>
        {isLatest && activity.type === 'tool_executing' ? (
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
        ) : (
          <span className="text-[10px]">{style.icon}</span>
        )}
      </div>
      
      {/* Content */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className={`text-sm font-medium ${style.color}`}>
              {title}
            </div>
            {activity.error && (
              <div className="text-xs text-red-600 mt-1">
                {activity.error}
              </div>
            )}
          </div>
          <time className="text-xs text-[var(--fg)]/50 whitespace-nowrap">
            {formatActivityTime(activity.timestamp)}
          </time>
        </div>
        
        {/* Expandable details */}
        {hasDetails && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[var(--fg)]/60 hover:text-[var(--fg)] flex items-center gap-1"
            >
              <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            
            {expanded && (
              <div className="mt-2 p-2 rounded bg-[var(--muted)] border border-[var(--border)]">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(activity.params || activity.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Workspace area showing agent information and activity.
 */
export function BrowserPane({ agent, activities, onClearActivities, isMobile = false }: BrowserPaneProps) {
  const activitiesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest activity
  useEffect(() => {
    activitiesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);
  
  return (
    <section className="h-full overflow-hidden">
      <div className="h-full border-r-2 border-l-2 border-[var(--border)] bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <span className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activities.length > 0 ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-medium">
                Activity Feed
              </span>
            </span>
          </div>
          {activities.length > 0 && onClearActivities && (
            <button
              onClick={onClearActivities}
              className="text-xs text-[var(--fg)]/60 hover:text-[var(--fg)] px-2 py-1 rounded hover:bg-[var(--muted)]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} h-[calc(100%-49px)] overflow-auto`}>
          {activities.length === 0 ? (
            // No activities state
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mb-4">
                  <svg
                    className="w-20 h-20 mx-auto text-[var(--fg)]/20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--fg)]/80 mb-2">
                  No activity yet
                </h3>
                <p className="text-sm text-[var(--fg)]/60">
                  Send a message to see the agent&apos;s process here. Tool executions, searches, and other activities will appear in real-time.
                </p>
              </div>
            </div>
          ) : (
            // Activity feed
            <div className="space-y-0">
              {activities.map((activity, index) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity}
                  isLatest={index === activities.length - 1}
                />
              ))}
              <div ref={activitiesEndRef} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


