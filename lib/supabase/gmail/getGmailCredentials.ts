// lib/supabase/gmail/getGmailCredentials.ts
// Purpose: Fetch stored Gmail OAuth credentials for a given user from Supabase.

import { createSupabaseAdminClient } from '../createAdminClient';
import { GmailCredentialRecord } from '@/types/gmail';

/**
 * Retrieve Gmail OAuth credentials for a Supabase user.
 * @param userId - Authenticated user's unique identifier.
 * @returns The stored credentials or null when none are available.
 */
export async function getGmailCredentials(userId: string): Promise<GmailCredentialRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('gmail_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Gmail credentials: ${error.message}`);
  }

  return data as GmailCredentialRecord | null;
}
