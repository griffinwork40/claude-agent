// lib/supabase/client.ts
// Purpose: Browser Supabase client using auth-helpers for cookie/session sync

"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function getBrowserSupabase() {
  return createClientComponentClient();
}


