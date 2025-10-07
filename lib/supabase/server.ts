// lib/supabase/server.ts
// Purpose: Server-side Supabase client utilities using auth-helpers and cookies

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

export function getServerSupabase() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(supabaseUrl, supabaseAnonKey, { cookies: () => cookieStore });
}


