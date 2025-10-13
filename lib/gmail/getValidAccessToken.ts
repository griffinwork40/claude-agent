// lib/gmail/getValidAccessToken.ts
// Purpose: Fetch or refresh a Gmail access token for the authenticated user.

import { getGmailCredentials } from '@/lib/supabase/gmail/getGmailCredentials';
import { saveGmailCredentials } from '@/lib/supabase/gmail/saveGmailCredentials';
import { GmailAccessTokenResult } from './types';
import { refreshGmailAccessToken } from './refreshAccessToken';

/**
 * Retrieve a valid Gmail access token for the supplied user.
 * Refreshes and persists updated tokens when expired.
 * @param userId - Authenticated Supabase user identifier.
 */
export async function getValidGmailAccessToken(userId: string): Promise<GmailAccessTokenResult> {
  const credentials = await getGmailCredentials(userId);
  if (!credentials) {
    throw new Error('No Gmail credentials found for user.');
  }

  const expiresAt = credentials.access_token_expires_at
    ? new Date(credentials.access_token_expires_at).getTime()
    : null;

  const now = Date.now();
  const bufferMs = 60 * 1000; // refresh 1 minute before expiration
  if (expiresAt && expiresAt - bufferMs > now) {
    return { accessToken: credentials.access_token, expiresAt };
  }

  if (!credentials.refresh_token) {
    return { accessToken: credentials.access_token, expiresAt };
  }

  const refreshed = await refreshGmailAccessToken(credentials.refresh_token);
  const newExpiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null;
  await saveGmailCredentials({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? credentials.refresh_token,
    scope: refreshed.scope ?? credentials.scope,
    tokenType: refreshed.token_type ?? credentials.token_type,
    accessTokenExpiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null
  });

  return { accessToken: refreshed.access_token, expiresAt: newExpiresAt };
}
