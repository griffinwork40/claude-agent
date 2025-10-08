// components/AuthFormWrapper.tsx
// Purpose: Wrapper component to handle useSearchParams with Suspense boundary
"use client";

import { useSearchParams } from 'next/navigation';
import AuthForm from './AuthForm';

interface AuthFormWrapperProps {
  mode: 'login' | 'signup';
}

export default function AuthFormWrapper({ mode }: AuthFormWrapperProps) {
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/settings';
  
  return <AuthForm mode={mode} redirect={redirect} />;
}