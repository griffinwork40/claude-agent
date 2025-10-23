/**
 * File: components/agents/chat/ChatComposer.tsx
 * Purpose: Input composer component extracted from ChatPane.tsx
 */
import { useRef, useEffect, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { VoiceRecordingReturn } from './useVoiceRecording';

interface ChatComposerProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  voiceRecording: VoiceRecordingReturn;
  isMobile: boolean;
}

export function ChatComposer({
  onSend,
  isStreaming,
  voiceRecording,
  isMobile,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerPadding = isMobile ? '0.5rem' : '0.75rem';

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Set the height to the scrollHeight, but cap it at a reasonable max
    const maxHeight = isMobile ? 120 : 100; // Max height in pixels
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [text, isMobile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText('');
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!text.trim() || isStreaming) return;
      onSend(text.trim());
      setText('');
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleVoiceToggle = async () => {
    const transcription = await voiceRecording.toggleRecording();
    if (transcription) {
      setText(prev => {
        if (!prev) {
          return transcription;
        }
        const delimiter = /\s$/.test(prev) ? '' : ' ';
        return `${prev}${delimiter}${transcription}`;
      });
    }
  };

  return (
    <footer
      className="flex-shrink-0 p-3 border-t border-[var(--border)] bg-[var(--bg)]"
      style={{
        paddingBottom: isMobile
          ? `calc(${composerPadding} + env(safe-area-inset-bottom, 0px))`
          : composerPadding,
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-end gap-2">
            <textarea
              ref={textareaRef}
              aria-label="Message"
              rows={isMobile ? 1 : 2}
              className="flex-1 resize-none rounded-xl bg-[var(--card)] text-[var(--fg)] placeholder-[var(--timestamp-subtle)] px-3 py-2.5 text-base border border-[var(--border)] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-150"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {voiceRecording.isAudioCaptureSupported && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={voiceRecording.microphoneDisabled}
                aria-pressed={voiceRecording.isRecording}
                aria-label={voiceRecording.microphoneAriaLabel}
                title={voiceRecording.microphoneAriaLabel}
                className="h-11 w-11 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--card)]/90 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {voiceRecording.isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : voiceRecording.isRecording ? (
                  <Square className="h-5 w-5 text-red-500" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isStreaming}
            className="self-stretch px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-blue-700 active:bg-blue-800 text-[var(--accent-foreground)] text-sm font-medium touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </div>
        {voiceRecording.statusMessage && (
          <p className="text-xs text-[var(--timestamp-subtle)]" aria-live="polite" role="status">
            {voiceRecording.statusMessage}
          </p>
        )}
      </form>
    </footer>
  );
}
