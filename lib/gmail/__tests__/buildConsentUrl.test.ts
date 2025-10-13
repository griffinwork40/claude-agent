// lib/gmail/__tests__/buildConsentUrl.test.ts
// Purpose: Ensure Gmail consent URL helper composes the correct query string.

import { afterEach, describe, expect, it } from 'vitest';
import { buildGmailConsentUrl } from '../buildConsentUrl';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('buildGmailConsentUrl', () => {
  it('throws when state is missing', () => {
    expect(() => buildGmailConsentUrl('')).toThrow('OAuth state must be provided.');
  });

  it('includes configured client values in the URL', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost/callback';
    process.env.GOOGLE_GMAIL_SCOPES = 'scope-one scope-two';

    const url = buildGmailConsentUrl('state-value');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost/callback');
    expect(parsed.searchParams.get('scope')).toBe('scope-one scope-two');
    expect(parsed.searchParams.get('state')).toBe('state-value');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
  });
});
