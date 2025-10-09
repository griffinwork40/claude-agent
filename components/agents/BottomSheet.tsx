/**
 * File: components/agents/BottomSheet.tsx
 * Purpose: Reusable bottom sheet component with smooth animations and gesture support.
 */
'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

/**
 * Bottom sheet that slides up from the bottom of the screen.
 * Includes backdrop, smooth animations, and click-outside-to-close.
 */
export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.body.style.overflow = 'hidden';
      sheetRef.current?.focus();
      return () => {
        document.body.style.overflow = '';
      };
    }

    document.body.style.overflow = '';
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only allow downward swipes
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    
    // Close if swiped down more than 100px
    if (diff > 100) {
      onClose();
    }
    
    // Reset transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    
    startY.current = 0;
    currentY.current = 0;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !sheetRef.current) {
      return;
    }

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
    ).filter((element) => !element.hasAttribute('aria-hidden'));

    if (focusableElements.length === 0) {
      event.preventDefault();
      sheetRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (activeElement === sheetRef.current) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    } else if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 bg-[var(--bg)] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out"
        style={{ height: '90dvh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Handle bar for swipe indicator */}
        <div className="flex justify-center py-3 border-b border-[var(--border)]">
          <div className="w-12 h-1.5 rounded-full bg-[var(--fg)]/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold text-[var(--fg)]">
              {title}
            </h2>
          ) : (
            <span id={titleId} className="sr-only">
              Bottom sheet dialog
            </span>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[var(--muted)] text-[var(--fg)]"
            aria-label="Close bottom sheet"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-3rem)] overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

