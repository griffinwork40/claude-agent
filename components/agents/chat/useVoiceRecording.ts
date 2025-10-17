/**
 * File: components/agents/chat/useVoiceRecording.ts
 * Purpose: Custom hook for voice recording functionality extracted from ChatPane.tsx
 */
import { useState, useRef, useEffect, useCallback } from 'react';

export interface VoiceRecordingState {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingError: string | null;
  isAudioCaptureSupported: boolean;
}

export interface VoiceRecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<string | null>;
}

export interface VoiceRecordingReturn extends VoiceRecordingState, VoiceRecordingActions {
  // Additional state for UI
  statusMessage: string;
  microphoneDisabled: boolean;
  microphoneAriaLabel: string;
}

/**
 * Custom hook for voice recording functionality
 */
export function useVoiceRecording(): VoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isAudioCaptureSupported, setIsAudioCaptureSupported] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Check for audio capture support on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaDevicesAvailable =
      typeof navigator !== 'undefined' && typeof navigator.mediaDevices !== 'undefined';
    const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';

    if (mediaDevicesAvailable && supportsMediaRecorder) {
      setIsAudioCaptureSupported(true);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  // Auto-stop recording after 60 seconds
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, 60_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isRecording]);

  const handleTranscription = useCallback(
    async (audioBlob: Blob): Promise<string | null> => {
      setIsTranscribing(true);
      setRecordingError(null);

      try {
        const transcriptionForm = new FormData();
        transcriptionForm.append('audio', audioBlob, `recording-${Date.now()}.webm`);

        const response = await fetch('/api/speech-to-text', {
          method: 'POST',
          body: transcriptionForm,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message =
            typeof errorBody.error === 'string'
              ? errorBody.error
              : 'Unable to transcribe audio right now.';
          setRecordingError(message);
          return null;
        }

        const data = (await response.json()) as { text?: string };
        return data.text || null;
      } catch (error) {
        console.error('Transcription request failed', error);
        setRecordingError('Unexpected error while transcribing audio.');
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const stopStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const startRecording = useCallback(async (): Promise<string | null> => {
    if (isTranscribing || !isAudioCaptureSupported) {
      return null;
    }

    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopStream();
        setIsRecording(false);
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];

        if (chunks.length === 0) {
          return null;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        return await handleTranscription(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      return null; // Will return transcription result via onstop
    } catch (error) {
      console.error('Failed to start audio recording', error);
      setRecordingError('Microphone permission denied or unavailable.');
      stopStream();
      mediaRecorderRef.current = null;
      return null;
    }
  }, [handleTranscription, isAudioCaptureSupported, isTranscribing, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const toggleRecording = useCallback(async (): Promise<string | null> => {
    if (isTranscribing) {
      return null;
    }

    if (!isRecording) {
      return await startRecording();
    }

    stopRecording();
    return null;
  }, [startRecording, stopRecording, isRecording, isTranscribing]);

  // Computed values for UI
  const microphoneDisabled = !isRecording && (isTranscribing || !isAudioCaptureSupported);
  const microphoneAriaLabel = isRecording
    ? 'Stop recording voice prompt'
    : isTranscribing
      ? 'Transcribing voice prompt'
      : 'Record a voice prompt';

  const statusMessage = recordingError
    ? recordingError
    : isTranscribing
      ? 'Transcribing voice prompt…'
      : isRecording
        ? 'Recording… tap the microphone to stop.'
        : '';

  return {
    // State
    isRecording,
    isTranscribing,
    recordingError,
    isAudioCaptureSupported,
    
    // Actions
    startRecording: async () => { await startRecording(); },
    stopRecording,
    toggleRecording: async () => { return await toggleRecording(); },
    
    // UI helpers
    microphoneDisabled,
    microphoneAriaLabel,
    statusMessage,
  };
}
