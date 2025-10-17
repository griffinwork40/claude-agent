/**
 * File: components/agents/chat/useChatStream.ts
 * Purpose: Custom hook for chat streaming functionality extracted from ChatPane.tsx
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Activity } from '../types';

const EPHEMERAL_ACTIVITY_TYPES: ReadonlySet<Activity['type']> = new Set([
  'text_chunk',
  'thinking_preview',
  'thinking',
  'status',
  'context_usage',
]);

export interface ContextUsage {
  percentage: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ChatStreamState {
  isStreaming: boolean;
  streamingMessage: string;
  sessionId: string | null;
  streamingStartedAt: string | null;
  contextUsage: ContextUsage | null;
  activities: Activity[];
}

export interface ChatStreamActions {
  sendMessage: (content: string, agentId: string) => Promise<void>;
  resetSession: () => void;
  addActivity: (activity: Activity) => void;
  syncExternalActivities: (agentId: string, activities: Activity[]) => void;
}

export interface ChatStreamReturn extends ChatStreamState, ChatStreamActions {
  // Additional computed state
  activitiesMap: Map<string, Activity>;
}

/**
 * Custom hook for chat streaming functionality
 */
export function useChatStream(
  agentId: string | null,
  onActivity?: (activity: Activity) => void
): ChatStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingStartedAt, setStreamingStartedAt] = useState<string | null>(null);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  
  // Track accumulated text chunks for proper interleaving
  const accumulatedTextRef = useRef<string>('');
  
  // Use Map for automatic activity deduplication by ID
  const [activitiesMap, setActivitiesMap] = useState<Map<string, Activity>>(new Map());

  // Convert Map to array for rendering
  const activities = Array.from(activitiesMap.values());

  // Reset session when agent changes
  useEffect(() => {
    console.log('Agent changed, resetting session', { agentId });
    setSessionId(null);
    setIsStreaming(false);
    setStreamingMessage('');
    setStreamingStartedAt(null);
    setContextUsage(null);
    // Clear activities map when switching agents
    setActivitiesMap(new Map());
    // Reset accumulated text refs
    accumulatedTextRef.current = '';
  }, [agentId]);

  // Listen for messages reloaded event
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleMessagesReloaded: EventListener = () => {
      setStreamingMessage('');
    };

    window.addEventListener('messages-reloaded', handleMessagesReloaded);

    return () => {
      window.removeEventListener('messages-reloaded', handleMessagesReloaded);
    };
  }, []);

  const resetSession = useCallback(() => {
    setIsStreaming(false);
    setStreamingMessage('');
    setStreamingStartedAt(null);
    setContextUsage(null);
    setActivitiesMap(new Map());
    accumulatedTextRef.current = '';
  }, []);

  const addActivity = useCallback((activity: Activity) => {
    const isEphemeral = EPHEMERAL_ACTIVITY_TYPES.has(activity.type) || activity.ephemeral === true;
    const annotatedActivity: Activity = isEphemeral
      ? { ...activity, ephemeral: true }
      : { ...activity, ephemeral: false };

    setActivitiesMap(prev => {
      const next = new Map(prev);
      next.set(annotatedActivity.id, annotatedActivity);
      return next;
    });
    
    if (onActivity && !annotatedActivity.ephemeral) {
      onActivity(annotatedActivity);
    }
  }, [onActivity]);

  const syncExternalActivities = useCallback((targetAgentId: string, activities: Activity[]) => {
    setActivitiesMap(prev => {
      const next = new Map<string, Activity>();

      // Preserve any ephemeral activities currently in-flight for this agent.
      prev.forEach(existing => {
        if (existing.agentId === targetAgentId && existing.ephemeral) {
          next.set(existing.id, existing);
        }
      });

      activities.forEach(activity => {
        next.set(activity.id, { ...activity, ephemeral: false });
      });

      return next;
    });
  }, []);

  const sendMessage = useCallback(async (content: string, targetAgentId: string) => {
    if (!targetAgentId || isStreaming) return;
    
    console.log('Starting streaming send...', {
      agentId: targetAgentId,
      content: content.substring(0, 50) + '...',
      sessionId,
      isStreaming
    });
    
    setIsStreaming(true);
    setStreamingMessage('');
    setStreamingStartedAt(new Date().toISOString());
    // Reset accumulated text ref to prevent carrying over old content
    accumulatedTextRef.current = '';
    
    try {
      console.log('Sending request to /api/chat...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId: sessionId,
          agentId: targetAgentId,
        }),
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('❌ No response body reader available');
        throw new Error('No response body');
      }

      console.log('✓ Starting to read stream...');
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✓ Stream reading completed');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++;
            try {
              const data = JSON.parse(line.slice(6));
              console.log(`Event ${eventCount}:`, data.type, data.content?.substring(0, 50) || data.tool || '...');
              
              if (data.type === 'chunk') {
                // Use ref as single source of truth to prevent duplication from stale closures
                // The functional state update pattern can cause issues with rapid updates
                const chunkContent = data.content;
                const beforeLength = accumulatedTextRef.current.length;
                accumulatedTextRef.current += chunkContent;
                const afterLength = accumulatedTextRef.current.length;
                
                console.log(`📝 Chunk ${eventCount}: "${chunkContent.substring(0, 30)}..." | Before: ${beforeLength} chars | After: ${afterLength} chars`);
                
                // Set state directly from ref to ensure consistency
                setStreamingMessage(accumulatedTextRef.current);
              } else if (data.type === 'complete') {
                console.log('✓ Stream completed, sessionId:', data.sessionId);

                // Set completion flag
                setSessionId(data.sessionId);
                setIsStreaming(false);
                setStreamingStartedAt(null);
                setContextUsage(null); // Clear context usage when stream completes
                
                // Reset accumulated text refs
                accumulatedTextRef.current = '';

                // Reload messages from database to show the complete assistant response
                // This prevents duplicates since we're using the DB as source of truth
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('reload-messages'));
                }
              } else if (data.type === 'messages-reloaded') {
                // Custom event to indicate messages have been reloaded
                console.log('✓ Messages reloaded, clearing streaming state and ephemeral activities');
                setStreamingMessage('');
                // Clear all ephemeral activities - they were just progress indicators
                setActivitiesMap(new Map());
                // Reset accumulated text refs
                accumulatedTextRef.current = '';
              } else if (data.type === 'error') {
                console.error('❌ Streaming error:', data.error);
                setIsStreaming(false);
                setStreamingMessage('');
                setStreamingStartedAt(null);
                setContextUsage(null); // Clear on error
                // Clear activities on error too
                setActivitiesMap(new Map());
                // Reset accumulated text refs
                accumulatedTextRef.current = '';
              } else if (data.type === 'context_usage') {
                // Update context usage state
                if (data.contextPercentage !== undefined && data.totalTokens !== undefined) {
                  setContextUsage({
                    percentage: data.contextPercentage,
                    totalTokens: data.totalTokens,
                    inputTokens: data.inputTokens || 0,
                    outputTokens: data.outputTokens || 0
                  });
                  console.log(`📊 Context usage: ${data.contextPercentage.toFixed(1)}% (${data.totalTokens} tokens)`);
                }
              } else if (
                data.type === 'tool_start' || 
                data.type === 'tool_params' || 
                data.type === 'tool_executing' || 
                data.type === 'tool_result' || 
                data.type === 'thinking' ||
                data.type === 'status' ||
                data.type === 'context_usage'
              ) {
                // When a tool or status event occurs, flush accumulated text as an activity
                // This creates proper interleaving: text -> tool -> text
                if (accumulatedTextRef.current && targetAgentId) {
                  const textChunkActivity: Activity = {
                    id: `chunk-${Date.now()}-${Math.random()}`,
                    agentId: targetAgentId,
                    type: 'text_chunk',
                    content: accumulatedTextRef.current,
                    timestamp: new Date().toISOString()
                  };
                  
                  addActivity(textChunkActivity);
                  
                  // Reset for next segment - both ref AND state must be cleared
                  accumulatedTextRef.current = '';
                  setStreamingMessage(''); // Reset state to match the ref
                }
                
                if (!targetAgentId) {
                  console.warn('Skipping activity with no agent context', data);
                  continue;
                }
                
                // Store activity locally for inline display
                const activity: Activity = {
                  id: `activity-${Date.now()}-${Math.random()}`,
                  agentId: targetAgentId,
                  type: data.type,
                  tool: data.tool,
                  toolId: data.toolId,
                  params: data.params,
                  result: data.result,
                  success: data.success,
                  message: data.message,
                  content: data.content,
                  error: data.error,
                  timestamp: new Date().toISOString()
                };
                console.log('📊 Activity created:', {
                  type: activity.type,
                  tool: activity.tool,
                  hasParams: !!activity.params,
                  hasResult: !!activity.result,
                  hasContent: !!activity.content,
                  message: activity.message
                });
                
                addActivity(activity);
              }
            } catch (e) {
              console.error('❌ Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error('❌ Error in streaming:', error);
      if (error instanceof Error) {
        console.error('Streaming error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      setIsStreaming(false);
      setStreamingMessage('');
      setStreamingStartedAt(null);
      // Clear activities on error
      setActivitiesMap(new Map());
    }
  }, [sessionId, isStreaming, addActivity]);

  return {
    // State
    isStreaming,
    streamingMessage,
    sessionId,
    streamingStartedAt,
    contextUsage,
    activities,
    activitiesMap,
    
    // Actions
    sendMessage,
    resetSession,
    addActivity,
    syncExternalActivities,
  };
}
