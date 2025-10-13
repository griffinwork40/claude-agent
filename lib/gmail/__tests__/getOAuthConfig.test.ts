// lib/gmail/__tests__/getOAuthConfig.test.ts
// Purpose: Validate Gmail OAuth configuration helper behavior.

import { afterEach, describe, expect, it } from 'vitest';
import { getGmailOAuthConfig } from '../getOAuthConfig';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getGmailOAuthConfig', () => {
  it('throws when required environment variables are missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;

    expect(() => getGmailOAuthConfig()).toThrow('Google OAuth environment variables are not fully configured.');
  });

  it('returns parsed configuration and splits scopes', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost/callback';
    process.env.GOOGLE_GMAIL_SCOPES = 'scope-one, scope-two ';

    const config = getGmailOAuthConfig();

    expect(config).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost/callback',
      scopes: ['scope-one', 'scope-two']
    });
  });
});
