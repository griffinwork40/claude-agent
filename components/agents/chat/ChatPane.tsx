/**
 * File: components/agents/chat/ChatPane.tsx
 * Purpose: Main orchestrator component for chat functionality
 */
import { useMemo, useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { ChatPaneProps, Activity, Message } from '../types';
import { useVoiceRecording } from './useVoiceRecording';
import { useChatStream } from './useChatStream';
import { ChatTimeline } from './ChatTimeline';
import { ChatComposer } from './ChatComposer';

interface RenderMessage extends Message {
  isStreaming?: boolean;
}

type TimelineItem = (RenderMessage & { itemType: 'message' }) | (Activity & { itemType: 'activity' });

/**
 * Main chat pane component that orchestrates all chat functionality
 */
export function ChatPane({
  agent,
  messages,
  activities: externalActivities,
  onSend,
  onActivity,
  isMobile = false,
}: ChatPaneProps) {
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(agent?.id ?? null);
  
  // Voice recording hook
  const voiceRecording = useVoiceRecording();
  
  // Chat streaming hook
  const chatStream = useChatStream(agent?.id ?? null, onActivity);

  // Reset session when agent changes
  useEffect(() => {
    if (agent?.id !== currentAgentId) {
      console.log('Agent changed, resetting session', { from: currentAgentId, to: agent?.id });
      setCurrentAgentId(agent?.id ?? null);
      chatStream.resetSession();
    }
  }, [agent?.id, currentAgentId, chatStream]);

  // Sync local activity map with the parent-provided history
  useEffect(() => {
    if (!agent?.id) {
      return;
    }

    const persistedActivities = externalActivities.filter(
      (activity) => activity.agentId === agent.id
    );
    chatStream.syncExternalActivities(agent.id, persistedActivities);
  }, [agent?.id, externalActivities, chatStream]);

  const visibleMessages = useMemo(() => {
    if (!agent) return [];
    console.log('Filtering messages:', {
      totalMessages: messages.length,
      agentId: agent.id,
      messages: messages.map(m => ({ id: m.id, agentId: m.agentId, role: m.role }))
    });
    const filtered = messages.filter((m) => m.agentId === agent.id);
    console.log('Visible messages after filter:', filtered.length);
    return filtered;
  }, [agent, messages]);

  // Consolidate related tool activities
  const consolidatedActivities = useMemo(() => {
    const consolidated: Activity[] = [];
    const toolMap = new Map<string, Activity>();
    const executingMap = new Map<string, Activity>();
    const filteredTypes = new Set<Activity['type']>(['tool_params']);
    
    for (const activity of chatStream.activities) {
      if (activity.type === 'tool_start' && activity.toolId) {
        toolMap.set(activity.toolId, activity);
        consolidated.push(activity);
        continue;
      }
      
      if (activity.type === 'tool_executing') {
        if (activity.toolId) {
          executingMap.set(activity.toolId, activity);
        }
        consolidated.push(activity);
        continue;
      }
      
      if (activity.type === 'tool_result' && activity.toolId) {
        const startActivity = toolMap.get(activity.toolId);
        if (startActivity) {
          // Create a new merged activity instead of mutating the original
          const mergedActivity: Activity = {
            ...startActivity,
            result: activity.result,
            success: activity.success,
            completedAt: activity.timestamp,
          };
          
          // Replace the original activity in the consolidated array
          const index = consolidated.findIndex(a => a.id === startActivity.id);
          if (index !== -1) {
            consolidated[index] = mergedActivity;
          }
        }
        
        const executingActivity = activity.toolId ? executingMap.get(activity.toolId) : undefined;
        if (executingActivity) {
          const executingIndex = consolidated.findIndex(a => a.id === executingActivity.id);
          if (executingIndex !== -1) {
            consolidated.splice(executingIndex, 1);
          }
          executingMap.delete(activity.toolId);
        }

        // Always include the result entry so result content is visible
        consolidated.push(activity);
        continue;
      }
      
      if (!filteredTypes.has(activity.type)) {
        consolidated.push(activity);
      }
    }
    
    return consolidated;
  }, [chatStream.activities]);

  // Merge messages and activities, sorted by timestamp
  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!agent) return [];
    
    const items: TimelineItem[] = [];
    
    // Add visible messages
    visibleMessages.forEach((message) => {
      items.push({ ...message, itemType: 'message' as const });
    });
    
    // Add consolidated activities
    consolidatedActivities.forEach((activity) => {
      items.push({ ...activity, itemType: 'activity' as const });
    });
    
    // Add streaming message only if there are NO text_chunk activities
    // (text_chunks already contain the streaming text, so we avoid duplication)
    const hasTextChunks = consolidatedActivities.some(a => a.type === 'text_chunk');
    if (chatStream.isStreaming && chatStream.streamingMessage && chatStream.streamingStartedAt && !hasTextChunks) {
      items.push({
        id: 'streaming-message',
        agentId: agent.id,
        role: 'assistant',
        content: chatStream.streamingMessage,
        createdAt: chatStream.streamingStartedAt,
        isStreaming: true,
        itemType: 'message' as const
      });
    }
    
    // Sort by timestamp
    items.sort((a, b) => {
      const aTime = new Date(a.itemType === 'message' ? a.createdAt : a.timestamp).getTime();
      const bTime = new Date(b.itemType === 'message' ? b.createdAt : b.timestamp).getTime();
      return aTime - bTime;
    });
    
    console.log('📋 Timeline items:', {
      total: items.length,
      messages: items.filter(i => i.itemType === 'message').length,
      activities: items.filter(i => i.itemType === 'activity').length,
      textChunks: items.filter(i => i.itemType === 'activity' && (i as Activity).type === 'text_chunk').length,
      streaming: chatStream.isStreaming
    });
    
    return items;
  }, [agent, visibleMessages, consolidatedActivities, chatStream.isStreaming, chatStream.streamingMessage, chatStream.streamingStartedAt]);

  const handleSend = async (content: string) => {
    if (!agent || chatStream.isStreaming) return;
    
    // Add user message to local state immediately
    const userMessageId = `msg-${Date.now()}-user`;
    const userMessage: Message = {
      id: userMessageId,
      agentId: agent.id,
      role: 'user',
      content: content,
      createdAt: new Date().toISOString(),
    };
    
    // Call onSend to add the user message to parent state
    onSend(content, agent.id, userMessage);
    
    // Start streaming
    await chatStream.sendMessage(content, agent.id);
  };

  const handleSendPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <section className={`flex flex-col h-full overflow-hidden ${!isMobile ? 'border-l' : ''} border-[var(--border)] bg-[var(--bg)]`}>
      {/* Desktop header - hidden on mobile to save space */}
      {!isMobile && (
        <header className="px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--fg)]">
              {agent ? `Chat — ${agent.name}` : 'Chat — no agent selected'}
            </div>
            {/* Context usage indicator - only shown during streaming */}
            {chatStream.isStreaming && chatStream.contextUsage && (
              <div 
                className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  chatStream.contextUsage.percentage < 70 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : chatStream.contextUsage.percentage < 90 
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
                title={`Input: ${chatStream.contextUsage.inputTokens.toLocaleString()} | Output: ${chatStream.contextUsage.outputTokens.toLocaleString()}`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>
                  {chatStream.contextUsage.percentage.toFixed(1)}% ({(chatStream.contextUsage.totalTokens / 1000).toFixed(1)}K/200K)
                </span>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Scrollable messages area */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'px-3 py-4' : 'p-3'}`} style={{ WebkitOverflowScrolling: 'touch' }}>
        <ChatTimeline
          agent={agent}
          messages={visibleMessages}
          activities={chatStream.activities}
          timelineItems={timelineItems}
          isStreaming={chatStream.isStreaming}
          streamingMessage={chatStream.streamingMessage}
          streamingStartedAt={chatStream.streamingStartedAt}
          isMobile={isMobile}
          onSendPrompt={handleSendPrompt}
        />
      </div>

      {/* Fixed composer at bottom with safe area support */}
      <ChatComposer
        onSend={handleSend}
        isStreaming={chatStream.isStreaming}
        voiceRecording={voiceRecording}
        isMobile={isMobile}
      />
    </section>
  );
}
