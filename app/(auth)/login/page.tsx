// app/(auth)/login/page.tsx
"use client";

import Link from 'next/link';
import AuthFormWrapper from '@/components/AuthFormWrapper';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-16 px-4">
        <Suspense fallback={<div className="text-center text-gray-600">Loading…</div>}>
          <AuthFormWrapper mode="login" />
        </Suspense>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don’t have an account?{' '}
          <Link href="/signup" className="text-indigo-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}


