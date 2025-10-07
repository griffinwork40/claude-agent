// lib/supabase/client.ts
// Purpose: Browser Supabase client using auth-helpers for cookie/session sync

"use client";

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

export function getBrowserSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}


