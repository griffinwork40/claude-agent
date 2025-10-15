/**
 * File: lib/activity-utils.ts
 * Purpose: Utility functions for activity persistence and management (Phase 2)
 */

import { Activity, ActivitiesResponse } from '@/components/agents/types';

/**
 * Load activities from the API
 */
export async function loadActivitiesFromAPI(
  agentId?: string,
  limit: number = 50,
  offset: number = 0,
  type?: string
): Promise<ActivitiesResponse> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (agentId) {
      params.append('agentId', agentId);
    }

    if (type) {
      params.append('type', type);
    }

    const response = await fetch(`/api/activities?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to load activities:', response.status, response.statusText);
      return { activities: [], hasMore: false };
    }

    const result = await response.json();
    return {
      activities: result.activities || [],
      hasMore: result.hasMore || false,
      total: result.total,
    };
  } catch (error) {
    console.error('Error loading activities:', error);
    return { activities: [], hasMore: false };
  }
}

/**
 * Create an activity via API
 */
export async function createActivity(activity: Omit<Activity, 'id' | 'timestamp'>): Promise<boolean> {
  try {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ activity }),
    });

    if (!response.ok) {
      console.error('Failed to create activity:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error creating activity:', error);
    return false;
  }
}

/**
 * Delete activities via API
 */
export async function deleteActivities(activityId?: string, olderThanDays?: number): Promise<boolean> {
  try {
    const params = new URLSearchParams();

    if (activityId) {
      params.append('id', activityId);
    }

    if (olderThanDays) {
      params.append('olderThan', olderThanDays.toString());
    }

    const response = await fetch(`/api/activities?${params}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to delete activities:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error deleting activities:', error);
    return false;
  }
}

/**
 * Batch create activities (for performance)
 */
export async function batchCreateActivities(activities: Omit<Activity, 'id' | 'timestamp'>[]): Promise<number> {
  let successCount = 0;

  // Create activities in parallel with some concurrency control
  const batchSize = 5;
  for (let i = 0; i < activities.length; i += batchSize) {
    const batch = activities.slice(i, i + batchSize);
    const promises = batch.map(activity => createActivity(activity));
    const results = await Promise.allSettled(promises);

    successCount += results.filter(result =>
      result.status === 'fulfilled' && result.value === true
    ).length;

    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < activities.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Batch create completed: ${successCount}/${activities.length} activities created`);
  return successCount;
}

/**
 * Activity deduplication - remove duplicate activities by type+tool+timestamp
 */
export function deduplicateActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  return activities.filter(activity => {
    const key = `${activity.type}-${activity.tool || 'no-tool'}-${activity.timestamp}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Merge activities from different sources (DB + live SSE)
 */
export function mergeActivities(
  persistedActivities: Activity[],
  liveActivities: Activity[],
  liveSince?: string
): Activity[] {
  if (!liveSince) {
    // No timestamp boundary, just deduplicate and sort
    return deduplicateActivities([...persistedActivities, ...liveActivities])
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Only include live activities that are newer than the boundary
  const cutoffTime = new Date(liveSince).getTime();
  const recentLiveActivities = liveActivities.filter(
    activity => new Date(activity.timestamp).getTime() > cutoffTime
  );

  // Merge with deduplication
  return deduplicateActivities([...persistedActivities, ...recentLiveActivities])
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Group activities by batch ID for batch progress tracking
 */
export function groupActivitiesByBatch(activities: Activity[]): Map<string, Activity[]> {
  const batches = new Map<string, Activity[]>();

  activities.forEach(activity => {
    if (activity.batchId) {
      if (!batches.has(activity.batchId)) {
        batches.set(activity.batchId, []);
      }
      batches.get(activity.batchId)!.push(activity);
    }
  });

  return batches;
}

/**
 * Calculate batch progress
 */
export function calculateBatchProgress(batchActivities: Activity[]): {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
} {
  const total = batchActivities.length || 1; // Avoid division by zero
  const completed = batchActivities.filter(a => a.type === 'tool_result' && a.success === true).length;
  const failed = batchActivities.filter(a => a.type === 'tool_result' && a.success === false).length;
  const inProgress = batchActivities.filter(a => a.type === 'tool_executing' || a.type === 'tool_start').length;

  return {
    total,
    completed,
    failed,
    inProgress,
    percentage: Math.round((completed / total) * 100),
  };
}

/**
 * Format activity duration for display
 */
export function formatDuration(milliseconds?: number): string {
  if (!milliseconds) return '';

  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.round((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Get a human-readable title for batch progress
 */
export function getBatchProgressTitle(batchActivities: Activity[]): string {
  const progress = calculateBatchProgress(batchActivities);

  if (progress.completed === progress.total) {
    return `Completed ${progress.total} tool${progress.total > 1 ? 's' : ''}`;
  } else if (progress.failed > 0) {
    return `${progress.completed} of ${progress.total} completed (${progress.failed} failed)`;
  } else {
    return `Executing ${progress.total} tool${progress.total > 1 ? 's' : ''}...`;
  }
}