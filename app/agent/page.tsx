/**
 * File: app/agent/page.tsx
 * Purpose: Responsive three-pane dashboard with mobile bottom sheet, tablet 2-pane, and desktop 3-pane layouts.
 */
'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Agent, Message, Activity } from '@/components/agents/types';
import { AgentList, BrowserPane, ChatPane, BottomSheet } from '@/components/agents';
import { ResizablePane } from '@/components/ResizablePane';
import { loadMessagesFromAPI } from '@/lib/message-utils';
import { loadActivitiesFromAPI, mergeActivities } from '@/lib/activity-utils';

/**
 * Generate a user-facing conversation title from the first user message.
 */
function buildConversationTitle(agentId: string, messages: Message[]): string {
  const normalizedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const firstUserMessage = normalizedMessages.find(
    (msg) => msg.role === 'user' && msg.content.trim().length > 0
  );
  if (firstUserMessage) {
    const condensedContent = firstUserMessage.content.replace(/\s+/g, ' ').trim();
    if (condensedContent.length === 0) {
      return 'Untitled conversation';
    }
    const MAX_LENGTH = 60;
    return condensedContent.length <= MAX_LENGTH
      ? condensedContent
      : `${condensedContent.slice(0, MAX_LENGTH - 1).trim()}…`;
  }

  if (agentId === 'default-agent') {
    return 'Job Application Assistant';
  }

  return `Conversation ${agentId.slice(-6)}`;
}

export const dynamic = 'force-dynamic';

export default function AgentPage() {
  const search = useSearchParams();
  const router = useRouter();

  const initialId = search.get('agentId');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialId ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [activitiesByAgent, setActivitiesByAgent] = useState<Record<string, Activity[]>>({});
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'chat'>('workspace');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const selectedAgent: Agent | null = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

  const selectedAgentActivities = useMemo(() => {
    if (!selectedAgentId) {
      return [] as Activity[];
    }

    return activitiesByAgent[selectedAgentId] ?? [];
  }, [activitiesByAgent, selectedAgentId]);

  // Load messages from database on mount
  useEffect(() => {
    async function loadMessages() {
      console.log('Loading messages from database...');
      setIsLoadingMessages(true);
      
      try {
        // Load all messages to create agents for existing conversations
        const loadedMessages = await loadMessagesFromAPI();
        console.log(`Loaded ${loadedMessages.length} messages from database`);
        
        if (loadedMessages.length > 0) {
          // Group messages by agentId to create agents for each conversation
          const messagesByAgent = loadedMessages.reduce((acc, message) => {
            const agentId = message.agentId;
            if (!acc[agentId]) {
              acc[agentId] = [];
            }
            acc[agentId].push(message);
            return acc;
          }, {} as Record<string, typeof loadedMessages>);
          
          // Create agents for each conversation
          const newAgents: Agent[] = Object.entries(messagesByAgent).map(([agentId, agentMessages]) => {
            const sortedMessages = [...agentMessages].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return {
              id: agentId,
              name: buildConversationTitle(agentId, sortedMessages),
              description:
                agentId === 'default-agent'
                  ? 'Your AI assistant for job searching and applications'
                  : 'Previous conversation',
              createdAt: sortedMessages[0].createdAt,
              updatedAt: sortedMessages[sortedMessages.length - 1].createdAt,
            };
          });
          
          setAgents(prev => {
            // Merge with existing agents, avoiding duplicates
            const existingIds = new Set(prev.map(a => a.id));
            const newUniqueAgents = newAgents.filter(a => !existingIds.has(a.id));
            return [...newUniqueAgents, ...prev];
          });
          
          if (!selectedAgentId) {
            // Select the most recently updated agent
            const mostRecentAgent = newAgents.sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0];
            
            setSelectedAgentId(mostRecentAgent.id);
            
            // Update URL to include the selected agent
            const params = new URLSearchParams(Array.from(search.entries()));
            params.set('agentId', mostRecentAgent.id);
            router.replace(`?${params.toString()}`);
          }
          
          setMessages(loadedMessages);

          // Load activities for the most recent agent if we have an initial agent
          if (newAgents.length > 0) {
            const mostRecentAgent = newAgents[0];
            try {
              setIsLoadingActivities(true);
              const loadedActivities = await loadActivitiesFromAPI(mostRecentAgent.id);
              console.log(`Loaded ${loadedActivities.activities.length} activities for initial agent ${mostRecentAgent.id}`);
              setActivitiesByAgent(prev => ({
                ...prev,
                [mostRecentAgent.id]: loadedActivities.activities
              }));
            } catch (error) {
              console.error('Error loading activities for initial agent:', error);
            } finally {
              setIsLoadingActivities(false);
            }
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    // Only load messages on initial mount, not when search params change
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally only run on mount
  
  // Listen for reload-messages events from ChatPane
  useEffect(() => {
    const handleReloadMessages = async () => {
      console.log('Reload messages event received');
      try {
        // Load messages for the currently selected agent
        const loadedMessages = await loadMessagesFromAPI(selectedAgentId || undefined);
        console.log(`Reloaded ${loadedMessages.length} messages from database for agent ${selectedAgentId}`);
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Error reloading messages:', error);
      }
    };
    
    window.addEventListener('reload-messages', handleReloadMessages);
    
    return () => {
      window.removeEventListener('reload-messages', handleReloadMessages);
    };
  }, [selectedAgentId]);

  function handleCreateAgent() {
    const now = new Date().toISOString();
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: 'New conversation',
      createdAt: now,
      updatedAt: now,
    };

    setAgents((prev) => [newAgent, ...prev]);
    setSelectedAgentId(newAgent.id);

    // Clear messages and activities for the new conversation
    setMessages([]);
    setActivitiesByAgent(prev => ({
      ...prev,
      [newAgent.id]: []
    }));

    // Update URL without causing a page refresh
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', newAgent.id);
    router.replace(`?${params.toString()}`);

    // On mobile, open the bottom sheet
    setIsBottomSheetOpen(true);
    setActiveTab('chat');
  }

  async function handleSelect(agentId: string) {
    // Only load if switching to a different agent
    if (agentId === selectedAgentId) {
      setIsBottomSheetOpen(true);
      return;
    }

    setSelectedAgentId(agentId);

    // Load messages for the selected agent
    try {
      const loadedMessages = await loadMessagesFromAPI(agentId);
      console.log(`Loaded ${loadedMessages.length} messages for agent ${agentId}`);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages for agent:', error);
      setMessages([]);
    }

    // Load activities for the selected agent (only if not already loaded)
    const hasActivities = activitiesByAgent[agentId]?.length > 0;
    if (!hasActivities) {
      try {
        setIsLoadingActivities(true);
        const loadedActivities = await loadActivitiesFromAPI(agentId);
        console.log(`Loaded ${loadedActivities.activities.length} activities for agent ${agentId}`);
        setActivitiesByAgent(prev => ({
          ...prev,
          [agentId]: loadedActivities.activities
        }));
      } catch (error) {
        console.error('Error loading activities for agent:', error);
        setActivitiesByAgent(prev => ({
          ...prev,
          [agentId]: []
        }));
      } finally {
        setIsLoadingActivities(false);
      }
    }

    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', agentId);
    router.replace(`?${params.toString()}`);

    // On mobile, open the bottom sheet when an agent is selected
    setIsBottomSheetOpen(true);
  }

  // Function to add a new message to the state
  function handleAddMessage(content: string, agentId: string, message: Message) {
    console.log('Adding message:', { agentId, role: message.role, content: content.substring(0, 50) });
    let agentMessagesForUpdate: Message[] = [];
    setMessages((prev) => {
      console.log('Previous messages count:', prev.length);
      const newMessages = [...prev, message];
      agentMessagesForUpdate = newMessages.filter((msg) => msg.agentId === agentId);
      console.log('New messages count:', newMessages.length);
      return newMessages;
    });

    setAgents((previousAgents) =>
      previousAgents.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        const updatedAgentMessages = [...agentMessagesForUpdate];
        const updatedName =
          message.role === 'user' ? buildConversationTitle(agentId, updatedAgentMessages) : agent.name;

        return {
          ...agent,
          name: updatedName,
          updatedAt: message.createdAt,
        };
      })
    );
  }

  function handleCloseBottomSheet() {
    setIsBottomSheetOpen(false);
  }

  const handleActivity = useCallback((activity: Activity) => {
    if (!activity.agentId) {
      console.warn('Received activity without agentId, skipping', activity);
      return;
    }
    // Update local state with the new activity
    setActivitiesByAgent(prev => {
      const existing = prev[activity.agentId] ?? [];

      // Merge with existing activities to avoid duplicates
      const mergedActivities = mergeActivities(existing, [activity]);

      return {
        ...prev,
        [activity.agentId]: mergedActivities
      };
    });
  }, []);

  const handleClearActivities = useCallback(() => {
    if (!selectedAgentId) {
      return;
    }

    // Clear activities from local state only
    // Note: Database cleanup would require API modification to support agent-based deletion
    setActivitiesByAgent(prev => {
      if (!prev[selectedAgentId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[selectedAgentId];
      return next;
    });
  }, [selectedAgentId]);

  // Show loading state while messages or activities are being loaded
  if (isLoadingMessages || (selectedAgentId && isLoadingActivities)) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-sm text-[var(--fg)]/70">
            {isLoadingMessages ? 'Loading conversations...' : 'Loading activity history...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Layout (< 768px) */}
      <div className="md:hidden h-[calc(100dvh-4rem)] bg-[var(--bg)] text-[var(--fg)]">
        <AgentList 
          agents={agents}
          selectedAgentId={selectedAgentId} 
          onSelect={handleSelect}
          onCreate={handleCreateAgent}
        />
        
        <BottomSheet 
          isOpen={isBottomSheetOpen} 
          onClose={handleCloseBottomSheet}
          title={selectedAgent?.name}
        >
          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] bg-[var(--bg)]">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'workspace'
                  ? 'text-[var(--fg)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--fg)]/60 hover:text-[var(--fg)]'
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-[var(--fg)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--fg)]/60 hover:text-[var(--fg)]'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'workspace' ? (
              <BrowserPane
                agent={selectedAgent}
                activities={selectedAgentActivities}
                onClearActivities={handleClearActivities}
                isMobile
              />
            ) : (
              <ChatPane
                agent={selectedAgent}
                messages={messages}
                activities={selectedAgentActivities}
                onSend={handleAddMessage}
                onActivity={handleActivity}
                isMobile
              />
            )}
          </div>
        </BottomSheet>
      </div>

      {/* Tablet Layout (768px - 1024px) */}
      <div className="hidden md:flex lg:hidden h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--fg)]">
        {/* Sidebar with toggle */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-0'} overflow-hidden`}>
          <AgentList 
            agents={agents}
            selectedAgentId={selectedAgentId} 
            onSelect={handleSelect}
            onCreate={handleCreateAgent}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with hamburger */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border)]">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-[var(--muted)] text-[var(--fg)]"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {selectedAgent && (
              <span className="text-sm font-medium text-[var(--fg)]">
                {selectedAgent.name}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] bg-[var(--bg)]">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'workspace'
                  ? 'text-[var(--fg)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--fg)]/60 hover:text-[var(--fg)]'
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-[var(--fg)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--fg)]/60 hover:text-[var(--fg)]'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'workspace' ? (
              <BrowserPane
                agent={selectedAgent}
                activities={selectedAgentActivities}
                onClearActivities={handleClearActivities}
              />
            ) : (
              <ChatPane
                agent={selectedAgent}
                messages={messages}
                activities={selectedAgentActivities}
                onSend={handleAddMessage}
                onActivity={handleActivity}
              />
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout (> 1024px) */}
      <div className="hidden lg:flex h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
        {/* Left sidebar - resizable */}
        <ResizablePane
          defaultWidth={280}
          minWidth={200}
          maxWidth={500}
          position="left"
        >
          <AgentList 
            agents={agents}
            selectedAgentId={selectedAgentId} 
            onSelect={handleSelect}
            onCreate={handleCreateAgent}
          />
        </ResizablePane>
        
        {/* Center workspace - flexible, takes remaining space */}
        <div className="flex-1 min-w-0">
          <BrowserPane
            agent={selectedAgent}
            activities={selectedAgentActivities}
            onClearActivities={handleClearActivities}
          />
        </div>
        
        {/* Right chat pane - resizable */}
        <ResizablePane
          defaultWidth={380}
          minWidth={300}
          maxWidth={600}
          position="right"
        >
          <ChatPane
            agent={selectedAgent}
            messages={messages}
            activities={selectedAgentActivities}
            onSend={handleAddMessage}
            onActivity={handleActivity}
          />
        </ResizablePane>
      </div>
    </>
  );
}


