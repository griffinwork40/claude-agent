/**
 * File: components/agents/BatchProgressIndicator.tsx
 * Purpose: Phase 2 component for displaying aggregate progress of batch tool execution
 * Design: Cursor-style collapsible tree view with checkmarks/spinners
 */

'use client';

import { useState, useMemo, useId } from 'react';
import { CheckCircle, XCircle, Zap } from 'lucide-react';
import { Activity } from './types';
import { formatDuration, getBatchProgressTitle } from '@/lib/activity-utils';

interface BatchProgressIndicatorProps {
  activities: Activity[];
  onExpand?: (expanded: boolean) => void;
  className?: string;
}

interface ToolProgress {
  activity: Activity;
  status: 'pending' | 'running' | 'completed' | 'failed';
  icon: React.ReactNode;
  color: string;
}

/**
 * Batch Progress Indicator - Shows progress for multiple tools executed together
 *
 * Design principles:
 * - Collapsible tree view with expand/collapse chevron
 * - Checkmarks for completed, X for failed, spinner for running
 * - Summary in collapsed state: "Executing 3 tools..."
 * - Detailed tree view when expanded
 * - Progress count: "2/3 complete" or visual indicators only
 */
export function BatchProgressIndicator({
  activities,
  onExpand,
  className = ''
}: BatchProgressIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsRegionId = useId();

  // Group activities by batch and calculate progress
  const batchData = useMemo(() => {
    const batches = new Map<string, Activity[]>();

    activities.forEach(activity => {
      if (activity.batchId) {
        if (!batches.has(activity.batchId)) {
          batches.set(activity.batchId, []);
        }
        batches.get(activity.batchId)!.push(activity);
      }
    });

    // Find the most recent active batch
    let activeBatch: { id: string; activities: Activity[] } | null = null;
    let latestTime = 0;

    for (const [batchId, batchActivities] of batches.entries()) {
      const batchTime = Math.max(...batchActivities.map(a => new Date(a.timestamp).getTime()));
      if (batchTime > latestTime) {
        latestTime = batchTime;
        activeBatch = { id: batchId, activities: batchActivities };
      }
    }

    if (!activeBatch) {
      return null;
    }

    // Process tool progress for the active batch
    const toolProgress: ToolProgress[] = [];
    const toolMap = new Map<string, Activity>();

    // Group activities by tool
    activeBatch.activities.forEach(activity => {
      if (activity.tool) {
        if (!toolMap.has(activity.tool)) {
          toolMap.set(activity.tool, activity);
        } else {
          // Update to latest activity for this tool
          const existing = toolMap.get(activity.tool)!;
          const newTime = new Date(activity.timestamp).getTime();
          const existingTime = new Date(existing.timestamp).getTime();
          if (newTime > existingTime) {
            toolMap.set(activity.tool, activity);
          }
        }
      }
    });

    // Determine status for each tool
    for (const [toolName, latestActivity] of toolMap.entries()) {
      let status: ToolProgress['status'] = 'pending';
      let icon: React.ReactNode = <div className="w-3 h-3 rounded-full border border-gray-400/40" />;
      let color = 'text-gray-400/60';

      switch (latestActivity.type) {
        case 'tool_start':
          status = 'running';
          icon = <Zap size={12} className="animate-pulse" />;
          color = 'text-blue-400/60';
          break;
        case 'tool_executing':
          status = 'running';
          icon = <Zap size={12} className="animate-pulse" />;
          color = 'text-amber-400/60';
          break;
        case 'tool_result':
          if (latestActivity.success === false) {
            status = 'failed';
            icon = <XCircle size={12} />;
            color = 'text-red-400/60';
          } else {
            status = 'completed';
            icon = <CheckCircle size={12} />;
            color = 'text-green-500/60';
          }
          break;
        default:
          status = 'pending';
          icon = <div className="w-3 h-3 rounded-full border border-gray-400/40" />;
          color = 'text-gray-400/60';
      }

      toolProgress.push({
        activity: latestActivity,
        status,
        icon,
        color
      });
    }

    const completed = toolProgress.filter(t => t.status === 'completed').length;
    const failed = toolProgress.filter(t => t.status === 'failed').length;
    const running = toolProgress.filter(t => t.status === 'running').length;
    const total = toolProgress.length;

    return {
      batchId: activeBatch.id,
      tools: toolProgress,
      completed,
      failed,
      running,
      total,
      isComplete: completed === total,
      hasFailures: failed > 0,
      duration: activeBatch.activities.find(a => a.duration)?.duration
    };
  }, [activities]);

  if (!batchData || batchData.total <= 1) {
    // Don't show batch indicator for single tools
    return null;
  }

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpand?.(newExpanded);
  };

  const getSummaryText = () => {
    if (batchData.isComplete) {
      if (batchData.hasFailures) {
        return `Completed ${batchData.total} tool${batchData.total > 1 ? 's' : ''} (${batchData.failed} failed)`;
      } else {
        return `Completed ${batchData.total} tool${batchData.total > 1 ? 's' : ''}`;
      }
    } else {
      return `Executing ${batchData.total} tool${batchData.total > 1 ? 's' : ''}...`;
    }
  };

  const getSummaryIcon = () => {
    if (batchData.isComplete) {
      if (batchData.hasFailures) {
        return <XCircle size={14} className="text-amber-400/70" />;
      } else {
        return <CheckCircle size={14} className="text-green-500/60" />;
      }
    } else {
      return <Zap size={14} className="text-blue-400/60" />;
    }
  };

  const timestamp = batchData.tools[0]?.activity.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className={`my-1 py-0.5 animate-fadeIn w-full ${className}`}>
      {/* Summary line - always visible */}
      <button
        type="button"
        className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted)]/20 rounded px-1 py-0.5 transition-colors w-full text-left"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? detailsRegionId : undefined}
      >
        {/* Expand/collapse indicator */}
        <div className="flex-shrink-0 text-gray-400/60">
          {isExpanded ? '▼' : '▶'}
        </div>

        {/* Status icon */}
        <div className="flex-shrink-0">
          {getSummaryIcon()}
        </div>

        {/* Summary text */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-xs text-[var(--fg)]/70 truncate block">
            {getSummaryText()}
          </span>
        </div>

        {/* Duration (if available) */}
        {batchData.duration && (
          <div className="flex-shrink-0 text-[11px] text-gray-400/60">
            {formatDuration(batchData.duration)}
          </div>
        )}

        {/* Timestamp */}
        <time className="text-[11px] text-[var(--fg)]/40 whitespace-nowrap flex-shrink-0">
          {formattedTime}
        </time>
      </button>

      {/* Expanded tree view */}
      {isExpanded && (
        <div id={detailsRegionId} className="ml-5 mt-1 animate-fadeIn">
          <div className="border-l border-gray-400/20 pl-2 space-y-1">
            {batchData.tools.map((tool, index) => (
              <div key={`${tool.activity.tool}-${index}`} className="flex items-center gap-2">
                {/* Tool status icon */}
                <div className={`flex-shrink-0 ${tool.color}`}>
                  {tool.icon}
                </div>

                {/* Tool name */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <span className="text-[11px] text-[var(--fg)]/60 truncate block">
                    {tool.activity.tool?.replace(/_/g, ' ') || 'Unknown tool'}
                  </span>
                </div>

                {/* Tool duration (if available) */}
                {tool.activity.duration && (
                  <div className="flex-shrink-0 text-[10px] text-gray-400/50">
                    {formatDuration(tool.activity.duration)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage batch progress state
 */
export function useBatchProgress(activities: Activity[]) {
  const [activeBatches, setActiveBatches] = useState<Set<string>>(new Set());

  const batchActivities = useMemo(() => {
    const batches = new Map<string, Activity[]>();

    activities.forEach(activity => {
      if (activity.batchId) {
        if (!batches.has(activity.batchId)) {
          batches.set(activity.batchId, []);
        }
        batches.get(activity.batchId)!.push(activity);
      }
    });

    return Array.from(batches.entries()).map(([batchId, batchActivities]) => ({
      batchId,
      activities: batchActivities,
      isComplete: batchActivities.some(a => a.type === 'batch_complete'),
      hasFailures: batchActivities.some(a =>
        a.type === 'tool_result' && a.success === false
      )
    }));
  }, [activities]);

  const addActiveBatch = (batchId: string) => {
    setActiveBatches(prev => new Set(prev).add(batchId));
  };

  const removeActiveBatch = (batchId: string) => {
    setActiveBatches(prev => {
      const newSet = new Set(prev);
      newSet.delete(batchId);
      return newSet;
    });
  };

  return {
    batchActivities,
    activeBatches,
    addActiveBatch,
    removeActiveBatch,
    hasActiveBatches: activeBatches.size > 0
  };
}

export default BatchProgressIndicator;