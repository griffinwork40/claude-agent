/**
 * File: components/ui/Button.tsx
 * Purpose: Minimal themed button component with primary and outline variants.
 */
'use client';

import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-readable font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600';
  const variants: Record<Variant, string> = {
    primary: 'bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-blue-700',
    outline: 'bg-[var(--muted)] text-[var(--fg)] border border-[var(--border)] hover:bg-white',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}


