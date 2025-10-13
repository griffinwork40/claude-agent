/**
 * File: components/agents/ThoughtPreviewChip.tsx
 * Purpose: Phase 2 component for displaying thought preview chips before tool execution
 * Design: Cursor-style lightweight, brain icon + text, fade in/out animations
 */

'use client';

import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { Activity } from './types';

interface ThoughtPreviewChipProps {
  activity: Activity;
  onFadeComplete?: () => void;
  className?: string;
}

/**
 * Thought Preview Chip - Shows what the agent is thinking before executing tools
 *
 * Design principles:
 * - Brain icon with muted gray color
 * - Smaller font (11px) with gray text
 * - Fade in animation, fade out after tool starts
 * - Single line display, no expansion
 * - Minimal visual impact, informative preview
 */
export function ThoughtPreviewChip({
  activity,
  onFadeComplete,
  className = ''
}: ThoughtPreviewChipProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Auto-fade out after 3 seconds or when tool execution starts
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);

      // Complete fade out after animation
      setTimeout(() => {
        setIsVisible(false);
        onFadeComplete?.();
      }, 300);
    }, 3000);

    return () => clearTimeout(fadeTimer);
  }, [onFadeComplete]);

  if (!isVisible || activity.type !== 'thinking_preview') {
    return null;
  }

  const formatThoughtContent = (content?: string): string => {
    if (!content) return 'Thinking...';

    // Clean up and format the thought content
    return content
      .replace(/^(Planning|Thinking|Preparing)/i, '$1')
      .replace(/\.\.\.$/, '')
      .trim();
  };

  const content = formatThoughtContent(activity.content);
  const timestamp = new Date(activity.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div
      className={`
        my-1 py-0.5 animate-fadeIn w-full
        transition-opacity duration-300 ease-in-out
        ${isFadingOut ? 'opacity-0' : 'opacity-100'}
        ${className}
      `}
    >
      <div className="flex items-center gap-2">
        {/* Brain icon - 14px, muted gray */}
        <div className="flex-shrink-0 text-gray-400/60">
          <Brain size={14} strokeWidth={1.5} />
        </div>

        {/* Content - 11px, muted gray */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span
            className="text-[11px] text-gray-400/80 truncate block italic"
            title={content}
          >
            {content}
          </span>
        </div>

        {/* Timestamp - always visible, right-aligned */}
        <time className="text-[10px] text-gray-400/40 whitespace-nowrap flex-shrink-0">
          {timestamp}
        </time>
      </div>
    </div>
  );
}

/**
 * Hook to manage thought preview lifecycle
 * Returns current thought preview and functions to clear it
 */
export function useThoughtPreview() {
  const [thoughtPreview, setThoughtPreview] = useState<Activity | null>(null);
  const [isPending, setIsPending] = useState(false);

  const showThoughtPreview = (activity: Activity) => {
    if (activity.type === 'thinking_preview') {
      setThoughtPreview(activity);
      setIsPending(true);
    }
  };

  const clearThoughtPreview = () => {
    setThoughtPreview(null);
    setIsPending(false);
  };

  const onThoughtComplete = () => {
    clearThoughtPreview();
  };

  return {
    thoughtPreview,
    isThoughtPending: isPending,
    showThoughtPreview,
    clearThoughtPreview,
    onThoughtComplete
  };
}

export default ThoughtPreviewChip;