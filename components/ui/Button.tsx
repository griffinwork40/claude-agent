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
    const childProps = child.props ?? {};
    const childClassName = (childProps?.className ?? '') as string;

    const composedProps: Record<string, unknown> = {};

    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('on') && typeof value === 'function') {
        const existingHandler = childProps[key];
        if (typeof existingHandler === 'function') {
          composedProps[key] = (...args: unknown[]) => {
            (existingHandler as (...args: unknown[]) => void)(...args);

            const [event] = args;
            const maybeEvent = event as {
              defaultPrevented?: boolean;
              isPropagationStopped?: () => boolean;
            } | undefined;

            if (maybeEvent?.defaultPrevented || maybeEvent?.isPropagationStopped?.()) {
              return;
            }

            (value as (...args: unknown[]) => void)(...args);
          };
          return;
        }
      }
      composedProps[key] = value;
    });

    return cloneElement(child, {
      ...childProps,
      ...composedProps,
      className: `${mergedClassName} ${childClassName}`.trim(),
    });
  }

  return (
    <button className={mergedClassName} {...props}>
      {children}
    </button>
  );
}


