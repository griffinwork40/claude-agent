// app/(auth)/signup/page.tsx
"use client";

import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const benefits = [
    'Launch collaborative hiring plans with plug-and-play templates.',
    'Share structured feedback instantly across your team.',
    'Give candidates a polished experience with automated nudges.',
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:py-20">
        <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:max-w-2xl lg:text-left">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)]/15 bg-gradient-to-br from-[var(--muted)]/90 via-[var(--card)] to-[var(--accent)]/10 p-10 shadow-[0_32px_80px_rgba(15,23,42,0.18)]">
            <div className="absolute -top-16 -right-16 hidden h-48 w-48 rounded-full bg-[var(--accent)]/20 blur-3xl lg:block" aria-hidden="true" />
            <div className="absolute -bottom-10 -left-10 hidden h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-3xl lg:block" aria-hidden="true" />
            <div className="relative space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--card)]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fg)]/60">
                Start with Enlist
              </p>
              <h1 className="text-display text-[var(--fg)]">
                Build a candidate journey people rave about
              </h1>
              <p className="text-readable text-[var(--fg)]/70">
                Craft structured hiring workflows, automate updates, and share insights in real time—without compromising accessibility.
              </p>
              <ul className="space-y-3 text-left">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-readable text-[var(--fg)]/80">
                    <span className="mt-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                      ✓
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-md">
          <Suspense fallback={<div className="text-center text-readable text-[var(--fg)]/60">Loading…</div>}>
            <AuthForm mode="signup" />
          </Suspense>
          <p className="mt-6 text-center text-sm text-[var(--fg)]/70">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


