/**
 * File: components/agents/types.ts
 * Purpose: Shared type definitions for the Agent dashboard UI. These types are
 * consumed by AgentList, BrowserPane, ChatPane, and the /agent page. Keep this
 * file framework-agnostic and free of React-specific imports.
 */

/**
 * A coarse-grained lifecycle state for an agent item in the dashboard.
 * - `open`: actively being worked on
 * - `ready`: queued and ready to open
 * - `awaiting`: requires user input or follow-up
 * - `expired`: no longer actionable
 */
export type AgentStep = 'open' | 'ready' | 'awaiting' | 'expired';

/**
 * Basic diff statistics attached to an agent when relevant (e.g., PRs).
 */
export interface DiffStats {
  plus: number;
  minus: number;
}

/**
 * Minimal representation of an agent item in the list.
 */
export interface Agent {
  id: string;
  name: string;
  repo: string; // e.g., owner/repo
  branch: string;
  status: AgentStep;
  updatedAt: string; // ISO timestamp
  author?: string; // optional owner/creator
  diffStats?: DiffStats;
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
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}

export interface BrowserPaneProps {
  agent: Agent | null;
}

export interface ChatPaneProps {
  agent: Agent | null;
  messages: Message[];
  onSend: (content: string) => void;
}


