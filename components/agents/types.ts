/**
 * File: components/agents/types.ts
 * Purpose: Shared type definitions for the Agent dashboard UI. These types are
 * consumed by AgentList, BrowserPane, ChatPane, and the /agent page. Keep this
 * file framework-agnostic and free of React-specific imports.
 */

/**
 * Minimal representation of an agent (conversation thread) in the list.
 * Agents can be used for job searching, resume building, email outreach, etc.
 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * A single chat message bound to an agent.
 */
export interface Message {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO timestamp
}

/**
 * Strongly typed props for the three panes. Public APIs are documented.
 */
export interface AgentListProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  onCreate: () => void;
}

export interface Activity {
  id: string;
  agentId: string;

  // Phase 2 extended event types
  type:
    | 'thinking_preview'  // NEW: Thought before tool execution
    | 'thinking'
    | 'status'
    | 'tool_start'
    | 'tool_params'
    | 'tool_executing'
    | 'tool_result'
    | 'batch_start'       // NEW: Batch execution starts
    | 'batch_progress'    // NEW: Batch progress update
    | 'batch_complete';   // NEW: Batch execution completes

  tool?: string;
  toolId?: string;

  // Batch tracking (Phase 2)
  batchId?: string;
  batchTotal?: number;
  batchCompleted?: number;

  // Content fields
  params?: any;
  result?: any;
  success?: boolean;
  message?: string;
  content?: string;
  error?: string;
  fallback_url?: string;

  // Timing (Phase 2)
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds

  // Metadata
  timestamp: string;
  isRedacted?: boolean;
}

export interface BrowserPaneProps {
  agent: Agent | null;
  activities: Activity[];
  onClearActivities?: () => void;
  isMobile?: boolean;
}

export interface ChatPaneProps {
  agent: Agent | null;
  messages: Message[];
  activities: Activity[];
  onSend: (content: string, agentId: string, message: Message) => void;
  onActivity?: (activity: Activity) => void;
  isMobile?: boolean;
}

/**
 * Database activity format (from Supabase)
 */
export interface DatabaseActivity {
  id: string;
  user_id: string;
  session_id: string;
  agent_id: string;
  type: Activity['type'];
  tool?: string;
  tool_id?: string;
  batch_id?: string;
  batch_total?: number;
  batch_completed?: number;
  params?: any;
  result?: any;
  content?: string;
  message?: string;
  error?: string;
  success?: boolean;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  is_redacted?: boolean;
  created_at: string;
}

/**
 * Activity utilities for database conversion
 */
export function convertDatabaseActivityToActivity(dbActivity: DatabaseActivity): Activity {
  return {
    id: dbActivity.id,
    agentId: dbActivity.agent_id,
    type: dbActivity.type,
    tool: dbActivity.tool,
    toolId: dbActivity.tool_id,
    batchId: dbActivity.batch_id,
    batchTotal: dbActivity.batch_total,
    batchCompleted: dbActivity.batch_completed,
    params: dbActivity.params,
    result: dbActivity.result,
    content: dbActivity.content,
    message: dbActivity.message,
    error: dbActivity.error,
    success: dbActivity.success,
    startedAt: dbActivity.started_at,
    completedAt: dbActivity.completed_at,
    duration: dbActivity.duration_ms,
    timestamp: dbActivity.created_at,
    isRedacted: dbActivity.is_redacted,
  };
}

/**
 * Activity API response types
 */
export interface ActivitiesResponse {
  activities: Activity[];
  hasMore: boolean;
  total?: number;
}

export interface CreateActivityRequest {
  activity: Omit<Activity, 'id' | 'timestamp'>;
}


