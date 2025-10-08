/**
 * File: components/agents/BrowserPane.tsx
 * Purpose: Middle-pane workspace showing agent activity and context.
 */
'use client';

import { BrowserPaneProps } from './types';

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Workspace area showing agent information and activity.
 */
export function BrowserPane({ agent, isMobile = false }: BrowserPaneProps) {
  return (
    <section className="h-full overflow-hidden">
      <div className="h-full border-r-2 border-l-2 border-[var(--border)] bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600" />
              <span className="font-medium">
                {agent ? agent.name : 'Workspace'}
              </span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} h-[calc(100%-49px)] overflow-auto`}>
          {!agent ? (
            // No agent selected state
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mb-4">
                  <svg
                    className="w-20 h-20 mx-auto text-[var(--fg)]/20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--fg)]/80 mb-2">
                  Select an agent to view workspace
                </h3>
                <p className="text-sm text-[var(--fg)]/60">
                  Choose an agent from the list to see job opportunities, resume drafts, and conversation context.
                </p>
              </div>
            </div>
          ) : (
            // Agent selected - show details
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[var(--fg)] mb-2">
                  {agent.name}
                </h2>
                {agent.description && (
                  <p className="text-sm text-[var(--fg)]/70 mb-3">
                    {agent.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-[var(--fg)]/60">
                  <span>Created {formatDate(agent.createdAt)}</span>
                  <span>•</span>
                  <span>Updated {formatDate(agent.updatedAt)}</span>
                </div>
              </div>

              {/* Placeholder for future content */}
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--muted)] p-8 text-center">
                  <p className="text-sm text-[var(--fg)]/60">
                    Job opportunities, resume drafts, and other workspace content will appear here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


