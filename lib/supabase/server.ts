// lib/supabase/server.ts
// Purpose: Server-side Supabase client utilities using auth-helpers and cookies

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export function getServerSupabase() {
  return createServerComponentClient({ cookies });
}


