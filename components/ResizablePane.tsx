/**
 * File: components/ResizablePane.tsx
 * Purpose: Resizable pane component with drag handle for adjusting width.
 */
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface ResizablePaneProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  position: 'left' | 'right';
  onWidthChange?: (width: number) => void;
}

export function ResizablePane({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  position,
  onWidthChange,
}: ResizablePaneProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);

  /**
   * Adjust the current pane width by a delta while clamping to the provided
   * minimum and maximum width values.
   *
   * @param delta - The amount to change the current width by.
   */
  const adjustWidthBy = useCallback(
    (delta: number) => {
      setWidth((prevWidth) => {
        const nextWidth = Math.max(
          minWidth,
          Math.min(maxWidth, prevWidth + delta),
        );

        if (nextWidth !== prevWidth) {
          onWidthChange?.(nextWidth);
        }

        return nextWidth;
      });
    },
    [maxWidth, minWidth, onWidthChange],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();

      if (!paneRef.current) {
        return;
      }

      const increment = 16;
      const isRtl =
        getComputedStyle(paneRef.current).direction === 'rtl';
      const isArrowRight = event.key === 'ArrowRight';
      const logicalDirection = isArrowRight ? 1 : -1;
      const flowDirection = isRtl ? -logicalDirection : logicalDirection;
      const positionDirection = position === 'left' ? 1 : -1;

      adjustWidthBy(flowDirection * positionDirection * increment);
    },
    [adjustWidthBy, position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!paneRef.current) return;

      const paneRect = paneRef.current.getBoundingClientRect();
      let newWidth: number;

      if (position === 'left') {
        newWidth = e.clientX - paneRect.left;
      } else {
        newWidth = paneRect.right - e.clientX;
      }

      // Constrain to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, minWidth, maxWidth, onWidthChange]);

  return (
    <div
      ref={paneRef}
      className="flex-shrink-0 relative h-full overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className={`absolute top-0 ${
          position === 'left'
            ? 'right-0 translate-x-1/2'
            : 'left-0 -translate-x-1/2'
        } group h-full w-11 cursor-col-resize select-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--accent)] ${
          isDragging
            ? 'bg-[var(--accent)]/20'
            : 'hover:bg-[var(--accent)]/10 active:bg-[var(--accent)]/20'
        }`}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-label={`Resize ${position} pane`}
        tabIndex={0}
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 flex w-2 -translate-x-1/2 items-center justify-center">
          <span
            className={`block h-11 w-px rounded-full bg-[var(--accent)] transition-opacity ${
              isDragging ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

