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

export const dynamic = 'force-dynamic';

/**
 * Normalize whitespace and trim a message for display.
 */
function summarizeContent(content: string, maxLength: number): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return 'Untitled conversation';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

/**
 * Determine the display name for an agent based on its messages.
 */
function deriveAgentName(agentId: string, messages: Message[]): string {
  if (agentId === 'default-agent') {
    return 'Job Application Assistant';
  }

  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (firstUserMessage) {
    return summarizeContent(firstUserMessage.content, 60);
  }

  return `Conversation ${agentId.slice(-6)}`;
}

/**
 * Determine the subtitle/description for an agent based on its latest message.
 */
function deriveAgentDescription(agentId: string, messages: Message[]): string | undefined {
  if (agentId === 'default-agent') {
    return 'Your AI assistant for job searching and applications';
  }

  if (messages.length === 0) {
    return undefined;
  }

  const latestMessage = messages[messages.length - 1];
  if (!latestMessage.content.trim()) {
    return undefined;
  }

  return summarizeContent(latestMessage.content, 80);
}

export default function AgentPage() {
  const search = useSearchParams();
  const router = useRouter();

  const initialId = search.get('agentId');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialId ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'chat'>('workspace');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const selectedAgent: Agent | null = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

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
              name: deriveAgentName(agentId, sortedMessages),
              description: deriveAgentDescription(agentId, sortedMessages),
              createdAt: sortedMessages[0].createdAt,
              updatedAt: sortedMessages[sortedMessages.length - 1].createdAt,
            };
          });
          
          setAgents((prev) => {
            const existingIds = new Set(prev.map((agent) => agent.id));

            const updatedExisting = prev.map((agent) => {
              const replacement = newAgents.find((candidate) => candidate.id === agent.id);
              return replacement ? { ...agent, ...replacement } : agent;
            });

            const newUniqueAgents = newAgents.filter((agent) => !existingIds.has(agent.id));

            return [...newUniqueAgents, ...updatedExisting];
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

        if (selectedAgentId && loadedMessages.length > 0) {
          const sortedMessages = [...loadedMessages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          setAgents((prevAgents) =>
            prevAgents.map((agent) => {
              if (agent.id !== selectedAgentId) {
                return agent;
              }

              return {
                ...agent,
                name: agent.id === 'default-agent' ? agent.name : deriveAgentName(agent.id, sortedMessages),
                description: deriveAgentDescription(agent.id, sortedMessages),
                updatedAt: sortedMessages[sortedMessages.length - 1].createdAt,
              };
            })
          );
        }
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
    
    // Clear messages for the new conversation
    setMessages([]);
    
    // Update URL without causing a page refresh
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', newAgent.id);
    router.replace(`?${params.toString()}`);
    
    // On mobile, open the bottom sheet
    setIsBottomSheetOpen(true);
    setActiveTab('chat');
  }

  async function handleSelect(agentId: string) {
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
    
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', agentId);
    router.replace(`?${params.toString()}`);
    
    // On mobile, open the bottom sheet when an agent is selected
    setIsBottomSheetOpen(true);
  }

  // Function to add a new message to the state
  function handleAddMessage(content: string, agentId: string, message: Message) {
    console.log('Adding message:', { agentId, role: message.role, content: content.substring(0, 50) });
    const hadUserMessage = messages.some((existing) => existing.agentId === agentId && existing.role === 'user');
    setMessages((prev) => {
      console.log('Previous messages count:', prev.length);
      const newMessages = [...prev, message];
      console.log('New messages count:', newMessages.length);
      return newMessages;
    });

    setAgents((prevAgents) =>
      prevAgents.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        const nextAgent: Agent = {
          ...agent,
          updatedAt: message.createdAt,
        };

        const normalizedContent = message.content.trim().replace(/\s+/g, ' ');
        if (normalizedContent) {
          nextAgent.description = summarizeContent(normalizedContent, 80);
        }

        if (message.role === 'user' && agentId !== 'default-agent' && !hadUserMessage && normalizedContent) {
          nextAgent.name = summarizeContent(normalizedContent, 60);
        }

        return nextAgent;
      })
    );
  }

  function handleCloseBottomSheet() {
    setIsBottomSheetOpen(false);
  }

  const handleActivity = useCallback((activity: Activity) => {
    setActivities(prev => [...prev, activity]);
  }, []);

  const handleClearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  // Show loading state while messages are being loaded
  if (isLoadingMessages) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-sm text-[var(--fg)]/70">Loading conversations...</p>
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
          <div className="h-[calc(100%-3rem)]">
            {activeTab === 'workspace' ? (
              <BrowserPane agent={selectedAgent} activities={activities} onClearActivities={handleClearActivities} isMobile />
            ) : (
              <ChatPane agent={selectedAgent} messages={messages} onSend={handleAddMessage} onActivity={handleActivity} isMobile />
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
              <BrowserPane agent={selectedAgent} activities={activities} onClearActivities={handleClearActivities} />
            ) : (
              <ChatPane agent={selectedAgent} messages={messages} onSend={handleAddMessage} onActivity={handleActivity} />
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
          <BrowserPane agent={selectedAgent} activities={activities} onClearActivities={handleClearActivities} />
        </div>
        
        {/* Right chat pane - resizable */}
        <ResizablePane
          defaultWidth={380}
          minWidth={300}
          maxWidth={600}
          position="right"
        >
          <ChatPane agent={selectedAgent} messages={messages} onSend={handleAddMessage} onActivity={handleActivity} />
        </ResizablePane>
      </div>
    </>
  );
}


