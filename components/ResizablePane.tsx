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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

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
      className="flex-shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className={`absolute top-0 ${
          position === 'left' ? 'right-0' : 'left-0'
        } h-full w-1 cursor-col-resize hover:bg-[var(--accent)]/50 transition-colors ${
          isDragging ? 'bg-[var(--accent)]' : ''
        } group`}
        onMouseDown={handleMouseDown}
      >
        {/* Wider hit area for easier grabbing */}
        <div className="absolute top-0 h-full w-3 -translate-x-1/2 left-1/2" />
      </div>
    </div>
  );
}

