// lib/supabase/service-client.ts
// Purpose: Provide a cached Supabase client configured with the service role key for server-side data access.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');

  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}

export function resetSupabaseServiceRoleClient(): void {
  cachedClient = null;
}
