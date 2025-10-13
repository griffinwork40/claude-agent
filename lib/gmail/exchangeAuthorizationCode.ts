// lib/gmail/exchangeAuthorizationCode.ts
// Purpose: Exchange a Google OAuth authorization code for Gmail access and refresh tokens.

import { getGmailOAuthConfig } from './getOAuthConfig';
import { GmailOAuthTokens } from './types';

/**
 * Exchange an OAuth authorization code for Gmail tokens.
 * @param code - Authorization code received from Google OAuth callback.
 * @returns Gmail access and refresh tokens.
 */
export async function exchangeAuthorizationCode(code: string): Promise<GmailOAuthTokens> {
  if (!code) {
    throw new Error('Authorization code is required.');
  }

  const config = getGmailOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to exchange authorization code: ${response.status} ${response.statusText} ${JSON.stringify(errorBody)}`);
  }

  const payload = (await response.json()) as GmailOAuthTokens;
  if (!payload.access_token) {
    throw new Error('Token response did not include an access token.');
  }

  return payload;
}
