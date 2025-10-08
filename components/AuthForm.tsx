// components/AuthForm.tsx
// Purpose: Reusable Auth form for email/password + OAuth buttons
"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/settings';
  const supabase = getBrowserSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.replace(redirect);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'github' | 'linkedin') {
    setLoading(true);
    setError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      });
    } catch (err: any) {
      setError(err.message || 'OAuth failed');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white border rounded-2xl mt-12">
      <h1 className="text-xl font-semibold mb-4">
        {mode === 'login' ? 'Log in to Enlist' : 'Create your account'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="text-sm text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full border rounded-md px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <div className="my-4 h-px bg-gray-200" />
      <div className="space-y-2">
        <button
          onClick={() => handleOAuth('google')}
          disabled={loading}
          className="w-full border py-2 rounded-md hover:bg-gray-50"
        >
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth('github')}
          disabled={loading}
          className="w-full border py-2 rounded-md hover:bg-gray-50"
        >
          Continue with GitHub
        </button>
        <button
          onClick={() => handleOAuth('linkedin')}
          disabled={loading}
          className="w-full border py-2 rounded-md hover:bg-gray-50"
        >
          Continue with LinkedIn
        </button>
      </div>
    </div>
  );
}


