// components/HeaderNavigation.tsx
"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { useAuth } from '@/lib/use-auth';

const navigationLinks = [
  { href: '/', label: 'Home', external: false },
  { href: '/agent', label: 'Agents', external: false },
  { href: '/dashboard', label: 'Dashboard', external: false },
];

type HeaderNavigationProps = {
  /**
   * Optional server-side authentication state for SSR.
   * If not provided, will use client-side auth state.
   */
  isAuthenticated?: boolean;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getLinkClasses(isActive: boolean) {
  const baseClasses = 'transition-colors hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';
  if (isActive) {
    return `${baseClasses} text-[var(--accent)] font-semibold`;
  }
  return `${baseClasses} text-[var(--fg)]`;
}

function isActivePath(pathname: string, href: string, external: boolean) {
  if (external) {
    return false;
  }
  if (href === '/') {
    return pathname === '/';
  }
  return pathname.startsWith(href);
}

function focusFirstElement(container: HTMLElement | null) {
  if (!container) {
    return;
  }
  const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
}

function handleFocusTrap(event: KeyboardEvent, container: HTMLElement | null, onClose: () => void) {
  if (!container) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') {
    return;
  }
  const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement | null;

  if (event.shiftKey) {
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault();
      lastElement.focus();
    }
  } else if (activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

export default function HeaderNavigation({ isAuthenticated: serverAuth }: HeaderNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const titleId = `${menuId}-title`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // Use real-time auth state
  const { isAuthenticated: clientAuth, loading, hasContext } = useAuth();
  
  // Use client-side auth state if context is available and not loading, fallback to server-side
  const isAuthenticated = hasContext && !loading ? clientAuth : serverAuth;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      return;
    }

    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    document.body.style.overflow = 'hidden';
    focusFirstElement(panelRef.current);

    function onKeyDown(event: KeyboardEvent) {
      handleFocusTrap(event, panelRef.current, closeMenu);
    }

    const panelElement = panelRef.current;
    panelElement?.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      panelElement?.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeMenu]);

  const lastPathnameRef = useRef(pathname);

  useEffect(() => {
    if (lastPathnameRef.current !== pathname && isOpen) {
      closeMenu();
    }
    lastPathnameRef.current = pathname;
  }, [pathname, isOpen, closeMenu]);

  function toggleMenu() {
    setIsOpen((current) => !current);
  }

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-4 text-readable md:flex">
        {navigationLinks.map(({ href, label, external }) => {
          const active = isActivePath(pathname, href, external);
          if (external) {
            return (
              <a
                key={href}
                href={href}
                className={getLinkClasses(active)}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            );
          }
          return (
            <Link key={href} href={href} className={getLinkClasses(active)} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
        {isAuthenticated ? (
          <LogoutButton />
        ) : (
          <Link href="/login" className="text-[var(--fg)] transition-colors hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            Log in
          </Link>
        )}
      </nav>
      <button
        type="button"
        ref={triggerRef}
        className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={toggleMenu}
      >
        <span className="sr-only">Toggle navigation menu</span>
        <span aria-hidden className="flex h-5 w-6 flex-col justify-between">
          <span className={`h-0.5 w-full bg-[var(--fg)] transition-transform ${isOpen ? 'translate-y-2 rotate-45' : ''}`}></span>
          <span className={`h-0.5 w-full bg-[var(--fg)] transition-opacity ${isOpen ? 'opacity-0' : 'opacity-100'}`}></span>
          <span className={`h-0.5 w-full bg-[var(--fg)] transition-transform ${isOpen ? '-translate-y-2 -rotate-45' : ''}`}></span>
        </span>
      </button>
      {isOpen ? (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden="true"
            onClick={closeMenu}
          />
          <div
            id={menuId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-y-0 right-0 z-50 h-full w-72 max-w-full bg-[var(--card)] p-6 shadow-lg focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-heading text-[var(--fg)]">
                Menu
              </h2>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                onClick={closeMenu}
              >
                <span className="sr-only">Close navigation menu</span>
                <span aria-hidden className="flex h-5 w-6 flex-col justify-between">
                  <span className="h-0.5 w-full bg-[var(--fg)] translate-y-2 rotate-45"></span>
                  <span className="h-0.5 w-full bg-[var(--fg)] opacity-0"></span>
                  <span className="h-0.5 w-full bg-[var(--fg)] -translate-y-2 -rotate-45"></span>
                </span>
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-4 text-readable">
              {navigationLinks.map(({ href, label, external }) => {
                const active = isActivePath(pathname, href, external);
                if (external) {
                  return (
                    <a
                      key={href}
                      href={href}
                      className={getLinkClasses(active)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={closeMenu}
                    >
                      {label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    className={getLinkClasses(active)}
                    aria-current={active ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    {label}
                  </Link>
                );
              })}
              {isAuthenticated ? (
                <LogoutButton />
              ) : (
                <Link
                  href="/login"
                  className="text-[var(--fg)] transition-colors hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  onClick={closeMenu}
                >
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
