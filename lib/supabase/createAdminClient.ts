// lib/supabase/createAdminClient.ts
// Purpose: Provide a reusable helper for constructing the Supabase service role client.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client that uses the service role key for privileged operations.
 * Throws an error when required environment variables are missing.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role credentials are not configured.');
  }

  return createClient(supabaseUrl, serviceKey);
}
