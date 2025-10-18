/**
 * File: components/agents/chat/activity-display-config.ts
 * Purpose: Display mapping configuration to transform raw tool activities into user-friendly displays
 */

import { Activity } from '../types';
import { Search, FileText, Send, Settings } from 'lucide-react';

export interface ActivityDisplayConfig {
  icon: React.ReactNode;
  title: string | ((activity: Activity) => string);
  stepType: 'thinking' | 'action' | 'result';
  expandable?: boolean;
  showParams?: boolean;
}

export const activityDisplayMap: Record<string, ActivityDisplayConfig> = {
  // Job search tools
  'search_jobs_google': {
    icon: <Search className="w-3.5 h-3.5" />,
    title: 'Searching job boards',
    stepType: 'action',
    expandable: true,
    showParams: false
  },
  'search_jobs_indeed': {
    icon: <Search className="w-3.5 h-3.5" />,
    title: 'Searching Indeed',
    stepType: 'action',
    expandable: true,
    showParams: false
  },
  'search_jobs_linkedin': {
    icon: <Search className="w-3.5 h-3.5" />,
    title: 'Searching LinkedIn',
    stepType: 'action',
    expandable: true,
    showParams: false
  },
  'get_job_details': {
    icon: <FileText className="w-3.5 h-3.5" />,
    title: 'Analyzing job details',
    stepType: 'action',
    expandable: true
  },
  'apply_to_job': {
    icon: <Send className="w-3.5 h-3.5" />,
    title: 'Submitting application',
    stepType: 'action',
    expandable: true
  },
  // Default fallbacks
  default: {
    icon: <Settings className="w-3.5 h-3.5" />,
    title: (activity) => activity.tool?.replace(/_/g, ' ') || 'Processing',
    stepType: 'action',
    expandable: true
  }
};

export function getActivityDisplay(activity: Activity): ActivityDisplayConfig {
  if (activity.tool && activityDisplayMap[activity.tool]) {
    return activityDisplayMap[activity.tool];
  }
  return activityDisplayMap.default;
}
