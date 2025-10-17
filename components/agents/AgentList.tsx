/**
 * File: components/agents/AgentList.tsx
 * Purpose: Left-pane list of conversation-based agents with search and empty state.
 */
'use client';

import { useMemo, useState } from 'react';
import { Agent, AgentListProps } from './types';

/**
 * Filter agents by search query and sort by most recent.
 */
function useFilteredAgents(agents: Agent[], query: string, showArchived: boolean = false) {
  const normalized = query.trim().toLowerCase();
  return useMemo(() => {
    const filtered = agents.filter((a) => {
      // Filter by archived status
      if (!showArchived && a.archived) return false;
      if (showArchived && !a.archived) return false;
      
      // Filter by search query
      if (!normalized) return true;
      return (
        a.name.toLowerCase().includes(normalized) ||
        (a.description && a.description.toLowerCase().includes(normalized))
      );
    });
    // Sort by most recent first
    return filtered.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [agents, normalized, showArchived]);
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Renders the left navigation pane with search, empty state, and agent list.
 */
export function AgentList(props: AgentListProps) {
  const { 
    agents, 
    selectedAgentId, 
    onSelect, 
    onCreate, 
    onArchive, 
    showArchived = false, 
    onToggleArchived 
  } = props;
  const [query, setQuery] = useState('');
  const filteredAgents = useFilteredAgents(agents, query, showArchived);

  return (
    <aside className="h-full overflow-y-auto border-r-2 border-[var(--border)] bg-[var(--bg)]">
      <div className="p-3 md:p-3 sticky top-0 bg-[var(--bg)] z-10">
        <div className="flex items-center gap-2 mb-2">
          <input
            aria-label="Search agents"
            placeholder="Search agents..."
            className="w-full rounded-md bg-[var(--muted)] text-[var(--fg)] placeholder-black/50 px-3 py-2 text-base md:text-sm border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="rounded-md bg-[var(--accent)] hover:bg-blue-700 text-[var(--accent-foreground)] px-3 py-2 text-sm font-medium touch-manipulation whitespace-nowrap"
            aria-label="Create new agent"
            onClick={onCreate}
          >
            New
          </button>
        </div>
        
        {/* Archive Toggle */}
        {onToggleArchived && (
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleArchived}
              className={`px-3 py-1 text-xs rounded-md transition ${
                showArchived 
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' 
                  : 'bg-[var(--muted)] text-[var(--fg)] hover:bg-[var(--border)]'
              }`}
            >
              {showArchived ? 'Show Active' : 'Show Archived'}
            </button>
            <span className="text-xs text-[var(--fg)]/60">
              {showArchived ? 'Viewing archived conversations' : 'Viewing active conversations'}
            </span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {agents.length === 0 && !query && (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center h-[calc(100%-80px)]">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-[var(--fg)]/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">
            No agents yet
          </h3>
          <p className="text-sm text-[var(--fg)]/70 mb-6 max-w-xs">
            Create your first agent to start searching for jobs, building resumes, or reaching out to employers.
          </p>
          <button
            onClick={onCreate}
            className="rounded-md bg-[var(--accent)] hover:bg-blue-700 text-[var(--accent-foreground)] px-4 py-2 text-sm font-medium"
          >
            Create Agent
          </button>
        </div>
      )}

      {/* Agent List */}
      {filteredAgents.length > 0 && (
        <div className="px-3 pb-6">
          <ul className="space-y-1">
            {filteredAgents.map((agent) => {
              const active = agent.id === selectedAgentId;
              return (
                <li key={agent.id}>
                  <div className="group relative">
                    <button
                      className={
                        'w-full text-left rounded-md px-3 py-3 md:py-2 transition border-2 touch-manipulation ' +
                        (active
                          ? 'bg-[var(--card)] text-[var(--fg)] border-[var(--border)]'
                          : 'bg-[var(--card)]/70 text-[var(--fg)]/90 border-transparent hover:border-[var(--border)]')
                      }
                      onClick={() => onSelect(agent.id)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[var(--fg)] text-base md:text-sm">
                          {agent.name}
                        </span>
                        <span className="text-xs text-[var(--fg)]/50">
                          {formatRelativeTime(agent.updatedAt)}
                        </span>
                      </div>
                      {agent.description && (
                        <div className="text-sm text-[var(--fg)]/60 line-clamp-1">
                          {agent.description}
                        </div>
                      )}
                    </button>
                    
                    {/* Archive Button */}
                    {onArchive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(agent.id, !agent.archived);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--muted)]"
                        title={agent.archived ? 'Unarchive conversation' : 'Archive conversation'}
                      >
                        {agent.archived ? (
                          <svg className="w-4 h-4 text-[var(--fg)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4M3 12h18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-[var(--fg)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4-4 4 4M3 12h18" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* No Search Results */}
      {agents.length > 0 && filteredAgents.length === 0 && query && (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm text-[var(--fg)]/70">
            No agents found matching &quot;{query}&quot;
          </p>
        </div>
      )}
    </aside>
  );
}


