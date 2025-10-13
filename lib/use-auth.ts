// lib/use-auth.ts
// Purpose: Custom hook for managing authentication state with real-time updates

"use client";

import { useAuthContext } from '@/components/AuthProvider';

export function useAuth() {
  return useAuthContext();
}