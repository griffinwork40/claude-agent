/**
 * File: components/agents/BottomSheet.tsx
 * Purpose: Reusable bottom sheet component with smooth animations and gesture support.
 */
'use client';

import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    // Prevent body scroll when sheet is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
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
      >
        {/* Handle bar for swipe indicator */}
        <div className="flex justify-center py-3 border-b border-[var(--border)]">
          <div className="w-12 h-1.5 rounded-full bg-[var(--fg)]/30" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--fg)]">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-[var(--muted)] text-[var(--fg)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="h-[calc(100%-3rem)] overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

