/**
 * File: components/LayoutWrapper.tsx
 * Purpose: Conditionally apply layout constraints based on the current route.
 */
'use client';

import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Full-width pages that shouldn't have container constraints
  const isFullWidth = pathname?.startsWith('/agent');
  
  if (isFullWidth) {
    return <main id="main">{children}</main>;
  }

  return (
    <main id="main" className="max-w-6xl mx-auto px-4 py-6">
      {children}
    </main>
  );
}

