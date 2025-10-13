// components/AuthProvider.tsx
// Purpose: Client-side authentication provider with real-time state management

"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession || null);
  const [loading, setLoading] = useState(!initialSession);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    
    // Get initial session if not provided
    if (!initialSession) {
      const getInitialSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
        } catch (error) {
          console.error('Error getting initial session:', error);
        } finally {
          setLoading(false);
        }
      };

      getInitialSession();
    } else {
      setLoading(false);
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialSession]);

  const value: AuthContextType = {
    session,
    user: session?.user || null,
    isAuthenticated: Boolean(session),
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}