// lib/supabase/gmail-credentials.ts
// Purpose: Read and persist Gmail OAuth credentials in Supabase using the service role client.

import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseServiceRoleClient } from './service-client';

export interface GmailCredentialsRecord {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expiry: string;
  created_at?: string;
  updated_at?: string;
}

function handleError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

export async function getGmailCredentials(userId: string): Promise<GmailCredentialsRecord | null> {
  if (!userId) {
    throw new Error('getGmailCredentials: userId is required');
  }

  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('gmail_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  handleError(error, 'Failed to fetch Gmail credentials');
  return data ?? null;
}

export interface UpsertGmailCredentialsInput {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiry: string;
}

export async function upsertGmailCredentials(input: UpsertGmailCredentialsInput): Promise<void> {
  const { userId, accessToken, refreshToken, expiry } = input;
  if (!userId || !accessToken || !refreshToken || !expiry) {
    throw new Error('upsertGmailCredentials: Missing required fields');
  }

  const client = getSupabaseServiceRoleClient();
  const { error } = await client
    .from('gmail_credentials')
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry,
      updated_at: new Date().toISOString(),
    });

  handleError(error, 'Failed to upsert Gmail credentials');
}

export async function deleteGmailCredentials(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('deleteGmailCredentials: userId is required');
  }

  const client = getSupabaseServiceRoleClient();
  const { error } = await client
    .from('gmail_credentials')
    .delete()
    .eq('user_id', userId);

  handleError(error, 'Failed to delete Gmail credentials');
}
