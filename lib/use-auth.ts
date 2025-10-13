// lib/use-auth.ts
// Purpose: Custom hook for managing authentication state with real-time updates

"use client";

import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);
  
  // If context is not available (e.g., in tests or standalone usage),
  // return default values with a flag to indicate context is not available
  if (!context) {
    return {
      session: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      hasContext: false
    };
  }
  
  return {
    ...context,
    hasContext: true
  };
}