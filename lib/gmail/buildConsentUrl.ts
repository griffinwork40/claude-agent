// lib/gmail/buildConsentUrl.ts
// Purpose: Generate the Google OAuth consent screen URL for Gmail integration.

import { getGmailOAuthConfig } from './getOAuthConfig';

/**
 * Build the Google OAuth consent URL for Gmail access.
 * @param state - CSRF token to include in the OAuth request.
 * @returns Fully qualified Google OAuth URL.
 */
export function buildGmailConsentUrl(state: string): string {
  if (!state) {
    throw new Error('OAuth state must be provided.');
  }

  const config = getGmailOAuthConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
