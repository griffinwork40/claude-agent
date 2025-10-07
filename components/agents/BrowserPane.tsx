/**
 * File: components/agents/BrowserPane.tsx
 * Purpose: Middle-pane placeholder simulating a workspace/browser area.
 */
'use client';

import { BrowserPaneProps } from './types';

/**
 * Static placeholder for the browser/workspace area.
 */
export function BrowserPane({ agent, isMobile = false }: BrowserPaneProps) {
  return (
    <section className={`h-full overflow-hidden ${!isMobile ? 'px-3' : ''}`}>
      <div className={`h-full ${!isMobile ? 'rounded-lg' : ''} border-2 border-[var(--border)] bg-[var(--card)]`}>
        <div className="flex items-center justify-between px-4 py-2 border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600" />
              {agent ? agent.name : 'No agent selected'}
            </span>
            {agent && !isMobile ? (
              <span className="text-[var(--fg)]/70">
                • {agent.repo} • {agent.branch}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs px-2 py-1 rounded-md bg-[var(--muted)] border border-[var(--border)] text-[var(--fg)] hover:bg-white">
              Details
            </button>
            <button className="text-xs px-2 py-1 rounded-md bg-[var(--muted)] border border-[var(--border)] text-[var(--fg)] hover:bg-white">
              Timeline
            </button>
          </div>
        </div>
        <div className={`${isMobile ? 'p-3' : 'p-6'} h-[calc(100%-41px)] overflow-auto`}>
          <div className={`h-full ${!isMobile ? 'min-h-[420px]' : 'min-h-[200px]'} rounded-md border-2 border-dashed border-[var(--border)] bg-[var(--muted)] flex items-center justify-center text-[var(--fg)]/80`}>
            Static workspace placeholder
          </div>
        </div>
      </div>
    </section>
  );
}


