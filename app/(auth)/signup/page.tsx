// app/(auth)/signup/page.tsx
"use client";

import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-16 px-4">
        <Suspense fallback={<div className="text-center text-gray-600">Loading…</div>}>
          <AuthForm mode="signup" />
        </Suspense>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}


