/**
 * File: components/agents/BrowserPane.tsx
 * Purpose: Middle-pane workspace - placeholder for future features like job listings, application status, etc.
 */
'use client';

import { BrowserPaneProps } from './types';

/**
 * Workspace area - placeholder for future content.
 */
export function BrowserPane({ agent, isMobile = false }: BrowserPaneProps) {
  return (
    <section className="h-full overflow-hidden">
      <div className="h-full border-r-2 border-l-2 border-[var(--border)] bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <span className="font-medium">
              Workspace
            </span>
          </div>
        </div>

        {/* Content - Placeholder */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} h-[calc(100%-49px)] overflow-auto`}>
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
                Workspace Coming Soon
              </h3>
              <p className="text-sm text-[var(--fg)]/60">
                Future features like job listings, application tracking, and document previews will appear here.
              </p>
              {agent && (
                <p className="text-xs text-[var(--fg)]/50 mt-4">
                  Currently working with: {agent.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


