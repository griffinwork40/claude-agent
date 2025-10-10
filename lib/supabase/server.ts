// lib/supabase/server.ts
// Purpose: Server-side Supabase client utilities using auth-helpers and cookies

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export function getServerSupabase() {
  // Check if we have the required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set, returning null client');
    return null;
  }
  
  try {
    return createServerComponentClient({ cookies });
  } catch (error) {
    console.warn('Failed to create Supabase client:', error);
    return null;
  }
}


