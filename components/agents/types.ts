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
  archived?: boolean;
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
  onArchive?: (agentId: string, archived: boolean) => void;
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
}

export interface Activity {
  id: string;
  type: 'tool_start' | 'tool_params' | 'tool_executing' | 'tool_result' | 'thinking' | 'status';
  tool?: string;
  toolId?: string;
  params?: any;
  result?: any;
  success?: boolean;
  message?: string;
  content?: string;
  error?: string;
  timestamp: string;
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
  onSend: (content: string, agentId: string, message: Message) => void;
  onActivity?: (activity: Activity) => void;
  isMobile?: boolean;
}


