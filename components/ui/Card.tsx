/**
 * File: components/ui/Card.tsx
 * Purpose: Simple themed card container used on landing and elsewhere.
 */
'use client';

import { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl bg-[var(--card)] border-2 border-[var(--border)] ${className}`} {...props} />
  );
}


