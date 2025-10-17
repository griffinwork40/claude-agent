// components/__tests__/BatchProgressIndicator.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BatchProgressIndicator } from '../agents/BatchProgressIndicator';
import type { Activity } from '../agents/types';

const baseTimestamp = new Date('2024-01-01T00:00:00Z');

const createActivity = (overrides: Partial<Activity>): Activity => ({
  id: 'activity-id',
  agentId: 'agent-1',
  type: 'tool_start',
  timestamp: baseTimestamp.toISOString(),
  ...overrides,
});

describe('BatchProgressIndicator accessibility', () => {
  it('toggles expansion when Enter key is pressed on the summary control', async () => {
    const activities: Activity[] = [
      createActivity({
        id: 'tool-a-result',
        batchId: 'batch-1',
        tool: 'resume_builder',
        type: 'tool_result',
        success: true,
        timestamp: new Date(baseTimestamp.getTime() + 1000).toISOString(),
      }),
      createActivity({
        id: 'tool-b-start',
        batchId: 'batch-1',
        tool: 'job_matcher',
        type: 'tool_start',
        timestamp: new Date(baseTimestamp.getTime() + 2000).toISOString(),
      }),
    ];

    render(<BatchProgressIndicator activities={activities} />);

    const summaryButton = screen.getByRole('button', { expanded: false });
    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');

    summaryButton.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');

    expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/job matcher/i)).toBeInTheDocument();
  });
});
