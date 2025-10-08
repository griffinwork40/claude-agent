// lib/supabase/client.ts
// Purpose: Browser Supabase client using auth-helpers for cookie/session sync

"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function getBrowserSupabase() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Return a mock client during build time to avoid errors
    return {
      auth: {
        signInWithPassword: () => Promise.resolve({ error: null }),
        signUp: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    } as any;
  }
  
  try {
    return createClientComponentClient();
  } catch (error) {
    // If Supabase client creation fails, return a mock client
    console.warn('Failed to create Supabase client, using mock client:', error);
    return {
      auth: {
        signInWithPassword: () => Promise.resolve({ error: null }),
        signUp: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    } as any;
  }
}


