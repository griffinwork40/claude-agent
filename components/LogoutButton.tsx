// components/LogoutButton.tsx
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.replace('/login');
  }
  return (
    <button onClick={handleLogout} className="text-sm text-gray-700 hover:text-gray-900">
      Log out
    </button>
  );
}


