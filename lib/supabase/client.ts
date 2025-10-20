// lib/supabase/client.ts
// Purpose: Browser Supabase client using auth-helpers for cookie/session sync

"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type BrowserSupabaseClient = ReturnType<typeof createClientComponentClient>;

let browserSupabaseClient: BrowserSupabaseClient | null = null;

/**
 * Retrieve a shared browser Supabase client instance for client-side auth and data access.
 * @returns {BrowserSupabaseClient} The cached Supabase client instance scoped to this module.
 */
export function getBrowserSupabase(): BrowserSupabaseClient {
  if (!browserSupabaseClient) {
    browserSupabaseClient = createClientComponentClient();
  }

  return browserSupabaseClient;
}


