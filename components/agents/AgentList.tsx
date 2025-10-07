/**
 * File: components/agents/AgentList.tsx
 * Purpose: Left-pane list of agents with search and grouping by lifecycle step.
 */
'use client';

import { useMemo, useState } from 'react';
import { Agent, AgentListProps } from './types';
import { mockAgents } from './mockData';

const groupLabels: Record<Agent['status'], string> = {
  open: 'Open',
  ready: 'Ready to open',
  awaiting: 'Awaiting follow-up',
  expired: 'Expired',
};

/**
 * Filter and group agents for list rendering.
 */
function useFilteredGroups(query: string) {
  const normalized = query.trim().toLowerCase();
  return useMemo(() => {
    const filtered = mockAgents.filter((a) => {
      if (!normalized) return true;
      return (
        a.name.toLowerCase().includes(normalized) ||
        a.repo.toLowerCase().includes(normalized) ||
        a.branch.toLowerCase().includes(normalized)
      );
    });
    const groups: Record<Agent['status'], Agent[]> = {
      open: [],
      ready: [],
      awaiting: [],
      expired: [],
    };
    for (const a of filtered) groups[a.status].push(a);
    return groups;
  }, [normalized]);
}

/**
 * Renders the left navigation pane with search and categorized agents.
 */
export function AgentList(props: AgentListProps) {
  const { selectedAgentId, onSelect } = props;
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(query);

  return (
    <aside className="h-full overflow-y-auto border-r border-[var(--border)] pr-2 bg-[var(--bg)]">
      <div className="p-2 sticky top-0 bg-[var(--bg)]">
        <div className="flex items-center gap-2">
          <input
            aria-label="Search agents"
            placeholder="Search agents..."
            className="w-full rounded-md bg-[var(--muted)] text-[var(--fg)] placeholder-black/50 px-3 py-2 text-readable border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="rounded-md bg-[var(--accent)] hover:bg-blue-700 text-[var(--accent-foreground)] px-3 py-2 text-readable"
            aria-label="Create new agent"
          >
            New
          </button>
        </div>
      </div>

      <div className="px-2 pb-6 space-y-6">
        {(Object.keys(groups) as Array<Agent['status']>).map((status) => {
          const list = groups[status];
          if (list.length === 0) return null;
          return (
            <section key={status}>
              <h3 className="px-2 mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--fg)]/70">
                {groupLabels[status]}
              </h3>
              <ul className="space-y-1">
                {list.map((agent) => {
                  const active = agent.id === selectedAgentId;
                  return (
                    <li key={agent.id}>
                      <button
                        className={
                          'w-full text-left rounded-md px-3 py-2 text-readable transition border-2 ' +
                          (active
                            ? 'bg-[var(--card)] text-[var(--fg)] border-[var(--border)]'
                            : 'bg-[var(--card)]/70 text-[var(--fg)]/90 border-transparent hover:border-[var(--border)]')
                        }
                        onClick={() => onSelect(agent.id)}
                        aria-current={active ? 'true' : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--fg)]">{agent.name}</span>
                          {agent.diffStats ? (
                            <span className="text-xs text-[var(--fg)]/70">
                              +{agent.diffStats.plus} -{agent.diffStats.minus}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-[var(--fg)]/70">
                          {agent.repo} • {agent.branch}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}


