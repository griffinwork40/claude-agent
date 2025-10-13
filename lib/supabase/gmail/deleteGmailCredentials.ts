// lib/supabase/gmail/deleteGmailCredentials.ts
// Purpose: Remove stored Gmail OAuth credentials for a user.

import { createSupabaseAdminClient } from '../createAdminClient';

/**
 * Delete Gmail OAuth credentials for the supplied Supabase user.
 * @param userId - Authenticated user's unique identifier.
 */
export async function deleteGmailCredentials(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('gmail_credentials')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete Gmail credentials: ${error.message}`);
  }
}
