/**
 * File: components/agents/chat/UnifiedProgressCard.tsx
 * Purpose: Unified batch progress card that consolidates multiple tool executions
 * Design: Replace multiple noisy activities with single, animated progress view
 * 
 * Features:
 * - Single animated card for all batch activities
 * - Real-time progress bar with shimmer effect
 * - Collapsible details showing individual tool status
 * - Smart auto-expand based on context
 * - Success cascade animation on completion
 * - Error handling with retry options
 */

'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Activity } from '../types';
import { formatDuration } from '@/lib/activity-utils';

interface UnifiedProgressCardProps {
  activities: Activity[];
  batchId: string;
  autoExpand?: boolean;
  onRetry?: (toolName: string) => void;
  className?: string;
}

interface ToolState {
  name: string;
  activity: Activity;
  status: 'idle' | 'thinking' | 'running' | 'completed' | 'failed';
  icon: React.ReactNode;
  color: string;
  duration?: number;
  error?: string;
  completedAt?: number; // timestamp for cascade animation
}

interface BatchState {
  phase: 'idle' | 'planning' | 'executing' | 'complete' | 'failed';
  tools: ToolState[];
  completed: number;
  failed: number;
  total: number;
  startedAt?: string;
  completedAt?: string;
  overallDuration?: number;
}

const PHASE_CONFIG = {
  idle: {
    icon: '🧠',
    text: 'Preparing...',
    color: 'text-gray-400/70',
  },
  planning: {
    icon: '🧠',
    text: 'Planning strategy...',
    color: 'text-blue-400/70',
  },
  executing: {
    icon: '🔍',
    text: 'Searching',
    color: 'text-blue-400/80',
  },
  complete: {
    icon: '✨',
    text: 'Complete',
    color: 'text-green-500/80',
  },
  failed: {
    icon: '⚠️',
    text: 'Completed with errors',
    color: 'text-amber-400/80',
  },
} as const;

/**
 * Get user-friendly title for batch based on tools being executed
 */
function getBatchTitle(tools: ToolState[]): string {
  if (tools.length === 0) return 'Processing';
  
  const toolNames = tools.map(t => t.name);
  
  // Check for common patterns
  if (toolNames.some(name => name.includes('search') || name.includes('job'))) {
    return 'Searching job boards';
  }
  if (toolNames.some(name => name.includes('resume'))) {
    return 'Analyzing resume';
  }
  if (toolNames.some(name => name.includes('email') || name.includes('outreach'))) {
    return 'Drafting outreach';
  }
  
  // Default: use tool count
  return `Executing ${tools.length} tool${tools.length > 1 ? 's' : ''}`;
}

/**
 * Unified Progress Card Component
 */
export function UnifiedProgressCard({
  activities,
  batchId,
  autoExpand = false,
  onRetry,
  className = '',
}: UnifiedProgressCardProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [showCascade, setShowCascade] = useState(false);
  const detailsId = useId();
  
  // Calculate batch state from activities
  const batchState = useMemo<BatchState>(() => {
    const toolMap = new Map<string, Activity>();
    let earliestStart: string | undefined;
    let latestComplete: string | undefined;
    
    // Group activities by tool name and find latest state for each
    activities.forEach(activity => {
      if (!activity.tool) return;
      
      const existing = toolMap.get(activity.tool);
      const activityTime = new Date(activity.timestamp).getTime();
      
      if (!existing || new Date(existing.timestamp).getTime() < activityTime) {
        toolMap.set(activity.tool, activity);
      }
      
      // Track timing
      if (activity.startedAt) {
        if (!earliestStart || activity.startedAt < earliestStart) {
          earliestStart = activity.startedAt;
        }
      }
      if (activity.completedAt) {
        if (!latestComplete || activity.completedAt > latestComplete) {
          latestComplete = activity.completedAt;
        }
      }
    });
    
    // Build tool states
    const tools: ToolState[] = [];
    let completed = 0;
    let failed = 0;
    
    for (const [toolName, activity] of toolMap.entries()) {
      let status: ToolState['status'] = 'idle';
      let icon: React.ReactNode = <div className="w-3 h-3 rounded-full border-2 border-gray-400/40" />;
      let color = 'text-gray-400/60';
      
      // Determine status based on activity type
      if (activity.type === 'thinking_preview') {
        status = 'thinking';
        icon = <Loader2 size={12} className="animate-spin" />;
        color = 'text-gray-400/70';
      } else if (activity.type === 'tool_start' || activity.type === 'tool_executing') {
        status = 'running';
        icon = <Loader2 size={12} className="animate-spin" />;
        color = 'text-blue-400/70';
      } else if (activity.type === 'tool_result') {
        if (activity.success === false) {
          status = 'failed';
          icon = <XCircle size={12} />;
          color = 'text-red-400/70';
          failed++;
        } else {
          status = 'completed';
          icon = <CheckCircle size={12} />;
          color = 'text-green-500/70';
          completed++;
        }
      }
      
      tools.push({
        name: toolName,
        activity,
        status,
        icon,
        color,
        duration: activity.duration,
        error: activity.error,
        completedAt: activity.completedAt ? new Date(activity.completedAt).getTime() : undefined,
      });
    }
    
    // Sort tools by completion time for cascade effect
    tools.sort((a, b) => {
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return a.completedAt - b.completedAt;
    });
    
    const total = tools.length;
    
    // Determine overall phase
    let phase: BatchState['phase'] = 'idle';
    if (completed + failed === total && total > 0) {
      phase = failed > 0 ? 'failed' : 'complete';
    } else if (tools.some(t => t.status === 'running' || t.status === 'completed')) {
      phase = 'executing';
    } else if (tools.some(t => t.status === 'thinking')) {
      phase = 'planning';
    }
    
    // Calculate overall duration
    let overallDuration: number | undefined;
    if (earliestStart && latestComplete) {
      overallDuration = new Date(latestComplete).getTime() - new Date(earliestStart).getTime();
    }
    
    return {
      phase,
      tools,
      completed,
      failed,
      total,
      startedAt: earliestStart,
      completedAt: latestComplete,
      overallDuration,
    };
  }, [activities]);
  
  // Trigger cascade animation when batch completes
  useEffect(() => {
    if (batchState.phase === 'complete' || batchState.phase === 'failed') {
      setShowCascade(true);
    }
  }, [batchState.phase]);
  
  // Auto-expand on first tool execution (if not manually collapsed)
  useEffect(() => {
    if (batchState.phase === 'executing' && batchState.total > 1 && !isExpanded) {
      // Check if user has manually set preference
      const userPref = localStorage.getItem(`batch-progress-collapsed-${batchId}`);
      if (userPref !== 'true') {
        setIsExpanded(true);
      }
    }
  }, [batchState.phase, batchState.total, batchId, isExpanded]);
  
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    // Store user preference
    localStorage.setItem(`batch-progress-collapsed-${batchId}`, (!newExpanded).toString());
  };
  
  const progressPercentage = batchState.total > 0 
    ? ((batchState.completed + batchState.failed) / batchState.total) * 100 
    : 0;
  
  const phaseConfig = PHASE_CONFIG[batchState.phase];
  const batchTitle = getBatchTitle(batchState.tools);
  
  // Don't render if no tools
  if (batchState.total === 0) {
    return null;
  }
  
  return (
    <div 
      className={`my-2 animate-fadeIn ${className}`}
      style={{
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Main progress card */}
      <div className={`rounded-lg border border-[var(--border)]/50 bg-[var(--card)]/30 overflow-hidden ${
        batchState.phase === 'planning' || batchState.phase === 'executing' 
          ? 'animate-cardShimmer' 
          : ''
      }`}>
        {/* Header - always visible */}
        <button
          type="button"
          onClick={handleToggle}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--muted)]/20 transition-colors text-left"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
        >
          {/* Expand/collapse chevron */}
          <div className={`text-[var(--fg)]/40 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </div>
          
          {/* Phase icon */}
          <div className={`text-base ${batchState.phase === 'planning' ? 'animate-iconPulse' : batchState.phase === 'executing' ? 'animate-iconGlow' : ''}`} role="img" aria-label={phaseConfig.text}>
            {phaseConfig.icon}
          </div>
          
          {/* Title and status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${phaseConfig.color}`}>
                {batchTitle}
              </span>
              {batchState.phase === 'executing' && (
                <span className="text-xs text-[var(--fg)]/50 font-mono">
                  [{batchState.completed + batchState.failed}/{batchState.total}]
                </span>
              )}
            </div>
          </div>
          
          {/* Duration */}
          {batchState.overallDuration && (
            <div className="text-xs text-[var(--fg)]/40 tabular-nums">
              {formatDuration(batchState.overallDuration)}
            </div>
          )}
        </button>
        
        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className={`relative h-1 bg-gray-400/20 rounded-full overflow-hidden ${batchState.phase === 'executing' ? 'animate-breathe' : ''}`}>
            {/* Progress fill */}
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
                batchState.phase === 'complete' 
                  ? 'bg-green-500/60' 
                  : batchState.phase === 'failed'
                  ? 'bg-amber-400/60'
                  : 'bg-blue-400/60'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
            
            {/* Shimmer effect while loading */}
            {batchState.phase === 'executing' && progressPercentage < 100 && (
              <div 
                className="absolute inset-0 shimmer-effect"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite linear',
                }}
              />
            )}
          </div>
        </div>
        
        {/* Expanded details */}
        {isExpanded && (
          <div id={detailsId} className="px-4 pb-4 space-y-2 animate-slideDown">
            {batchState.tools.map((tool, index) => {
              // Calculate stagger delay for cascade effect
              const cascadeDelay = showCascade && tool.status === 'completed' 
                ? index * 50 
                : 0;
              
              return (
                <div
                  key={`${tool.name}-${index}`}
                  className="flex items-center gap-3 pl-4 border-l-2 border-[var(--border)]/30"
                  style={{
                    animation: showCascade && tool.status === 'completed'
                      ? `cascadeCheck 0.3s ease-out ${cascadeDelay}ms`
                      : undefined,
                  }}
                >
                  {/* Tool status icon */}
                  <div className={`flex-shrink-0 ${tool.color}`}>
                    {tool.icon}
                  </div>
                  
                  {/* Tool name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--fg)]/70 truncate block">
                      {tool.name.replace(/_/g, ' ')}
                    </span>
                    
                    {/* Error message if failed */}
                    {tool.error && (
                      <div className="flex items-center gap-2 mt-1">
                        <XCircle size={10} className="text-red-400/70 flex-shrink-0" />
                        <span className="text-[11px] text-red-400/80 truncate">
                          {tool.error}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Duration */}
                  {tool.duration && (
                    <div className="text-[11px] text-[var(--fg)]/40 tabular-nums">
                      {formatDuration(tool.duration)}
                    </div>
                  )}
                  
                  {/* Retry button for failed tools */}
                  {tool.status === 'failed' && onRetry && (
                    <button
                      onClick={() => onRetry(tool.name)}
                      className="text-[11px] text-blue-400/70 hover:text-blue-400/90 underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
            
            {/* Warning message if some tools failed */}
            {batchState.failed > 0 && batchState.phase === 'failed' && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]/30">
                <div className="flex items-start gap-2">
                  <XCircle size={14} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--fg)]/70">
                      {batchState.failed === batchState.total 
                        ? 'All tools failed. Please try again.'
                        : `${batchState.failed} of ${batchState.total} tool${batchState.total > 1 ? 's' : ''} failed. Continuing with available results...`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Success summary (collapsed state when complete) */}
      {!isExpanded && batchState.phase === 'complete' && (
        <div className="mt-2 text-xs text-green-500/70 flex items-center gap-2 px-4">
          <CheckCircle size={12} />
          <span>
            Completed successfully • {batchState.total} tool{batchState.total > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// Add keyframes to global styles (will be added to globals.css)
const animationStyles = `
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes cascadeCheck {
  0% {
    opacity: 0;
    transform: translateX(-10px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.3s ease-out;
}

.shimmer-effect {
  pointer-events: none;
}
`;

export default UnifiedProgressCard;
