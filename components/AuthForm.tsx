// components/AuthForm.tsx
// Purpose: Reusable Auth form for email/password + OAuth buttons
"use client";

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type OAuthProvider = 'google' | 'github' | 'linkedin';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

interface FieldErrors {
  email?: string;
  password?: string;
}

/**
 * Renders an authentication form with email/password and OAuth sign-in options.
 * @param {AuthFormProps} props - Props configuring whether to render login or signup labels.
 * @returns {JSX.Element} Rendered authentication form.
 */
export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/settings';
  const supabase = getBrowserSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const helperText = useMemo(
    () => ({
      email: 'We’ll send important updates to this email.',
      password:
        mode === 'signup'
          ? 'Use at least 8 characters to keep your account secure.'
          : 'Enter the password linked to your Enlist account.',
    }),
    [mode],
  );

  const oauthProviders: Array<{ id: OAuthProvider; label: string; icon: React.ReactNode; description: string }> = [
    {
      id: 'google',
      label: 'Continue with Google',
      icon: <GoogleIcon />,
      description: 'Sign in using your Google workspace credentials',
    },
    {
      id: 'github',
      label: 'Continue with GitHub',
      icon: <GithubIcon />,
      description: 'Use your GitHub account for quick access',
    },
    {
      id: 'linkedin',
      label: 'Continue with LinkedIn',
      icon: <LinkedInIcon />,
      description: 'Authenticate with your professional profile',
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setFieldErrors({ email: 'Please enter your email address.' });
      setLoading(false);
      return;
    }

    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }

    if (mode === 'signup' && password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters long.' });
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (error) throw error;
      }
      router.replace(redirect);
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setLoading(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      });
    } catch (err: any) {
      setFormError(err.message || 'OAuth failed');
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 w-full max-w-md border-[var(--border)]/20 bg-[var(--card)] px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
      <div className="space-y-2 text-center">
        <h1 className="text-display text-[var(--fg)]">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-readable text-[var(--fg)]/70">
          {mode === 'login'
            ? 'Log in to review curated roles, drafts, and application history.'
            : 'Join Enlist to launch your AI-powered job search in minutes.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--fg)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby="email-helper"
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-[var(--fg)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 ${
              fieldErrors.email ? 'border-[var(--danger)] bg-[var(--danger-soft)] ring-2 ring-[var(--danger)]/30' : 'border-[var(--border)]/20 bg-[var(--card)]'
            }`}
          />
          <p
            id="email-helper"
            className={`mt-2 text-sm ${fieldErrors.email ? 'text-[var(--danger)]' : 'text-[var(--fg)]/60'}`}
            role={fieldErrors.email ? 'alert' : undefined}
          >
            {fieldErrors.email ?? helperText.email}
          </p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--fg)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="password-helper"
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-[var(--fg)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 ${
              fieldErrors.password
                ? 'border-[var(--danger)] bg-[var(--danger-soft)] ring-2 ring-[var(--danger)]/30'
                : 'border-[var(--border)]/20 bg-[var(--card)]'
            }`}
          />
          <p
            id="password-helper"
            className={`mt-2 text-sm ${fieldErrors.password ? 'text-[var(--danger)]' : 'text-[var(--fg)]/60'}`}
            role={fieldErrors.password ? 'alert' : undefined}
          >
            {fieldErrors.password ?? helperText.password}
          </p>
        </div>
        {formError && (
          <p className="text-sm font-medium text-[var(--danger)]" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </Button>
      </form>
      <div className="my-6 h-px bg-[var(--border)]/10" aria-hidden />
      <div className="space-y-3">
        {oauthProviders.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            onClick={() => handleOAuth(provider.id)}
            disabled={loading}
            className="w-full justify-start gap-3 rounded-lg bg-[var(--card)]/80 px-4 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--fg)]">
              {provider.icon}
            </span>
            <span className="flex flex-col text-left">
              <span className="text-sm font-semibold text-[var(--fg)]">{provider.label}</span>
              <span className="text-xs text-[var(--fg)]/60">{provider.description}</span>
            </span>
          </Button>
        ))}
      </div>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M21 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.1c-.2 1-.8 2-1.7 2.6v2.2h2.8c1.7-1.6 2.8-3.9 2.8-6.7Z"
        fill="currentColor"
        className="text-[#4285F4]"
      />
      <path
        d="M12 22c2.4 0 4.4-.8 5.9-2.3l-2.8-2.2c-.8.5-1.8.8-3.1.8-2.4 0-4.4-1.6-5.1-3.7H4V17c1.5 3 4.6 5 8 5Z"
        fill="currentColor"
        className="text-[#34A853]"
      />
      <path
        d="M6.9 13.6c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6V7H4C3.4 8.3 3 9.6 3 11s.4 2.7 1 4l2.9-1.4Z"
        fill="currentColor"
        className="text-[#FBBC05]"
      />
      <path
        d="M12 6.5c1.3 0 2.5.4 3.4 1.2l2.5-2.5C16.4 3.6 14.4 2.8 12 2.8 8.6 2.8 5.5 4.8 4 7.8l2.9 2.3c.7-2.1 2.7-3.6 5.1-3.6Z"
        fill="currentColor"
        className="text-[#EA4335]"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.2 9.3 7.6 10.8.6.1.8-.3.8-.6v-2c-3.1.7-3.7-1.5-3.7-1.5-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 1.6 2.7 1.2.1-.8.4-1.3.8-1.7-2.5-.3-5.1-1.3-5.1-5.8 0-1.3.5-2.5 1.2-3.4-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.2a11.6 11.6 0 0 1 6.2 0c2.4-1.5 3.4-1.2 3.4-1.2.6 1.7.2 3 .1 3.3.8.9 1.2 2 1.2 3.4 0 4.5-2.6 5.4-5.1 5.7.4.4.8 1.1.8 2.3v3.3c0 .3.2.7.8.6 4.4-1.5 7.6-5.8 7.6-10.8C23.4 5.6 18.3.5 12 .5Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4.5 3.5a2.5 2.5 0 1 1-.1 5 2.5 2.5 0 0 1 .1-5Zm-2.1 7.2h4.2v11.7H2.4V10.7Zm6.6 0h4V13h.1c.6-1.2 2.2-2.4 4.5-2.4 4.8 0 5.7 3.1 5.7 7.1v7.2h-4.2v-6.4c0-1.5 0-3.5-2.1-3.5s-2.4 1.6-2.4 3.4v6.5h-4.1V10.7Z" />
    </svg>
  );
}


