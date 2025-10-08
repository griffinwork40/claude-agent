"use client";
// lib/supabase.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SupabaseContext = createContext<any>(null);

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export const SupabaseProvider = ({ children }: SupabaseProviderProps) => {
  const [supabase, setSupabase] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        setSupabase(client);
      } else {
        console.error('Supabase environment variables are not set');
      }
    }
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
};
