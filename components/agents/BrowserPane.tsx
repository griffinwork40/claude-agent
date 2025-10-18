/**
 * File: components/agents/BrowserPane.tsx
 * Purpose: Middle-pane workspace - placeholder for future features like job listings, application status, etc.
 */

'use client';

import { BrowserPreview } from './BrowserPreview';
import { BrowserPaneProps } from './types';

/**
 * Workspace area - placeholder for future content.
 */
export function BrowserPane({ agent, isMobile = false }: BrowserPaneProps) {
  const sessionId = agent?.id;

  return (
    <section className="h-full overflow-hidden">
      <div className="h-full border-r-2 border-l-2 border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <span className="font-medium">Automation Workspace</span>
          </div>
        </div>

        <div className={`${isMobile ? 'p-3' : 'p-6'} h-[calc(100%-49px)] overflow-auto`}>
          {sessionId ? (
            <BrowserPreview sessionId={sessionId} />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-[var(--fg)]/60">
              Select or create a conversation to launch the live browser preview.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


