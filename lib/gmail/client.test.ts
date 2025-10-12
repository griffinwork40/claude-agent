// lib/gmail/client.test.ts
// Purpose: Ensure Gmail client helpers handle OAuth exchange, token refresh, and Gmail API calls correctly.

import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const gmailCredentialMocks = vi.hoisted(() => ({
  get: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn()
}));

vi.mock('@/lib/supabase/gmail-credentials', () => ({
  getGmailCredentials: gmailCredentialMocks.get,
  upsertGmailCredentials: gmailCredentialMocks.upsert,
  deleteGmailCredentials: gmailCredentialMocks.delete
}));

import {
  buildOAuthConsentUrl,
  exchangeAuthorizationCode,
  listGmailThreads,
  sendGmailMessage,
  markGmailThreadRead
} from './client';

const originalFetch = global.fetch;

function mockJsonResponse(json: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json)
  } as unknown as Response;
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://example.com/api/integrations/gmail/callback';
  gmailCredentialMocks.get.mockReset();
  gmailCredentialMocks.upsert.mockReset();
  global.fetch = vi.fn();
});

describe('buildOAuthConsentUrl', () => {
  it('includes client id, redirect, scopes, and state', () => {
    const url = buildOAuthConsentUrl('state-123');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('redirect_uri=' + encodeURIComponent('https://example.com/api/integrations/gmail/callback'));
    expect(url).toContain('scope=');
    expect(url).toContain('state=state-123');
  });
});

describe('exchangeAuthorizationCode', () => {
  it('exchanges code and persists tokens', async () => {
    const fetchMock = global.fetch as unknown as Mock;
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 })
    );

    const payload = await exchangeAuthorizationCode('user-1', 'code-xyz');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('oauth2.googleapis.com/token'), expect.objectContaining({
      method: 'POST'
    }));
    expect(gmailCredentialMocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      accessToken: 'access',
      refreshToken: 'refresh'
    }));
    expect(payload.accessToken).toBe('access');
  });
});

describe('gmail API helpers', () => {
  it('refreshes expired tokens before listing threads', async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    gmailCredentialMocks.get.mockResolvedValueOnce({
      user_id: 'user-2',
      access_token: 'old-access',
      refresh_token: 'refresh-token',
      expiry: expired
    });

    const fetchMock = global.fetch as unknown as Mock;
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ access_token: 'new-access', expires_in: 3600 }))
      .mockResolvedValueOnce(mockJsonResponse({
        threads: [
          { id: 'thread-1', historyId: '5', snippet: 'Hello' }
        ]
      }));

    const threads = await listGmailThreads('user-2', { maxResults: 5 });

    expect(gmailCredentialMocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-2',
      accessToken: 'new-access'
    }));
    expect(fetchMock.mock.calls[1][0]).toContain('/threads');
    expect(threads).toHaveLength(1);
  });

  it('sends messages with Gmail API', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    gmailCredentialMocks.get.mockResolvedValueOnce({
      user_id: 'user-3',
      access_token: 'active-access',
      refresh_token: 'refresh-token',
      expiry: future
    });

    const fetchMock = global.fetch as unknown as Mock;
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: 'message-1' }));

    const result = await sendGmailMessage('user-3', {
      to: 'person@example.com',
      subject: 'Test',
      body: 'Body'
    });

    expect(result.id).toBe('message-1');
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit?.method).toBe('POST');
    const parsed = JSON.parse(requestInit?.body as string);
    expect(parsed.raw).toBeTruthy();
  });

  it('marks threads as read', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    gmailCredentialMocks.get.mockResolvedValueOnce({
      user_id: 'user-4',
      access_token: 'token',
      refresh_token: 'refresh-token',
      expiry: future
    });

    const fetchMock = global.fetch as unknown as Mock;
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true }));

    await markGmailThreadRead('user-4', 'thread-99');
    expect(fetchMock.mock.calls[0][0]).toContain('/threads/thread-99/modify');
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});
