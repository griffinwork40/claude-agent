/**
 * File: components/ui/Button.tsx
 * Purpose: Minimal themed button component with primary and outline variants.
 */
'use client';

import { ButtonHTMLAttributes, ReactElement, ReactNode, cloneElement, isValidElement } from 'react';

type Variant = 'primary' | 'outline';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  asChild?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'primary', className = '', asChild = false, children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-readable font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600';
  const variants: Record<Variant, string> = {
    primary: 'bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-blue-700',
    outline: 'bg-[var(--muted)] text-[var(--fg)] border border-[var(--border)] hover:bg-white',
  };
  const mergedClassName = `${base} ${variants[variant]} ${className}`.trim();

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement;
    const childClassName = (child.props?.className ?? '') as string;
    return cloneElement(child, {
      className: `${mergedClassName} ${childClassName}`.trim(),
    });
  }

  return (
    <button className={mergedClassName} {...props}>
      {children}
    </button>
  );
}


