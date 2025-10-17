/**
 * File: components/agents/ChatPane.test.tsx
 * Purpose: Validates ChatPane streaming error handling and recovery UX.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPane } from '@/components/agents/ChatPane';
import type { Agent, Message } from '@/components/agents/types';

const baseAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const renderChatPane = (messages: Message[] = []) =>
  render(
    <ChatPane
      agent={baseAgent}
      messages={messages}
      activities={[]}
      onSend={vi.fn()}
      isMobile={false}
    />
  );

describe('ChatPane streaming error handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    (window.HTMLElement.prototype as any).scrollIntoView = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('displays an alert when streaming fails and clears it after retry', async () => {
    const failureResponse = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    const encoder = new TextEncoder();
    const streamChunks = [
      { done: false, value: encoder.encode('data: {"type":"complete","sessionId":"abc"}\n') },
      { done: true, value: undefined },
    ];

    const mockReader = {
      read: vi.fn().mockImplementation(() =>
        Promise.resolve(streamChunks.shift() ?? { done: true, value: undefined })
      ),
    };

    const successResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: {
        getReader: () => mockReader,
      },
    } as unknown as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(successResponse);

    global.fetch = fetchMock as unknown as typeof fetch;

    renderChatPane();

    const composer = screen.getByLabelText('Message');
    const sendButton = screen.getByRole('button', { name: /send/i });
    const user = userEvent.setup();

    await user.type(composer, 'First attempt');
    await user.click(sendButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't send your message.");

    await user.type(composer, ' retry');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    await user.click(sendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockReader.read).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
