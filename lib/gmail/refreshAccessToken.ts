// lib/gmail/refreshAccessToken.ts
// Purpose: Refresh an expired Gmail access token using the stored refresh token.

import { getGmailOAuthConfig } from './getOAuthConfig';
import { GmailOAuthTokens } from './types';

/**
 * Refresh a Gmail access token using the supplied refresh token.
 * @param refreshToken - Long-lived refresh token from Google OAuth.
 * @returns Updated access token payload.
 */
export async function refreshGmailAccessToken(refreshToken: string): Promise<GmailOAuthTokens> {
  if (!refreshToken) {
    throw new Error('Refresh token is required to refresh Gmail access tokens.');
  }

  const config = getGmailOAuthConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to refresh Gmail access token: ${response.status} ${response.statusText} ${JSON.stringify(errorBody)}`);
  }

  const payload = (await response.json()) as GmailOAuthTokens;
  if (!payload.access_token) {
    throw new Error('Refresh response did not include an access token.');
  }

  return payload;
}
