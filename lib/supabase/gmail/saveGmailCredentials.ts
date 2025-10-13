// lib/supabase/gmail/saveGmailCredentials.ts
// Purpose: Persist Gmail OAuth credentials for a user, replacing any existing entry.

import { createSupabaseAdminClient } from '../createAdminClient';
import { GmailCredentialRecordInput } from '@/types/gmail';

/**
 * Store Gmail OAuth credentials for a Supabase user.
 * @param record - Token details to persist for the user.
 */
export async function saveGmailCredentials(record: GmailCredentialRecordInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('gmail_credentials')
    .upsert({
      user_id: record.userId,
      access_token: record.accessToken,
      refresh_token: record.refreshToken,
      scope: record.scope,
      token_type: record.tokenType,
      access_token_expires_at: record.accessTokenExpiresAt,
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to store Gmail credentials: ${error.message}`);
  }
}
