/**
 * File: app/agent/page.tsx
 * Purpose: Responsive three-pane dashboard with mobile bottom sheet, tablet 2-pane, and desktop 3-pane layouts.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Agent, Message } from '@/components/agents/types';
import { AgentList, BrowserPane, ChatPane, BottomSheet } from '@/components/agents';
import { mockMessages } from '@/components/agents/mockData';
import { ResizablePane } from '@/components/ResizablePane';

export default function AgentPage() {
  const search = useSearchParams();
  const router = useRouter();

  const initialId = search.get('agentId');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialId ?? null
  );
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'chat'>('workspace');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const selectedAgent: Agent | null = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

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
    
    // Update URL
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', newAgent.id);
    router.push(`?${params.toString()}`);
    
    // On mobile, open the bottom sheet
    setIsBottomSheetOpen(true);
    setActiveTab('chat');
  }

  function handleSelect(agentId: string) {
    setSelectedAgentId(agentId);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', agentId);
    router.push(`?${params.toString()}`);
    
    // On mobile, open the bottom sheet when an agent is selected
    setIsBottomSheetOpen(true);
  }

  function handleSend(content: string) {
    if (!selectedAgent) return;
    
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      agentId: selectedAgent.id,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    
    // Auto-name agent based on first message
    if (selectedAgent.name === 'New conversation' && content.trim()) {
      const autoName = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '');
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgent.id
            ? { ...a, name: autoName, updatedAt: new Date().toISOString() }
            : a
        )
      );
    } else {
      // Update the agent's updatedAt timestamp
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgent.id
            ? { ...a, updatedAt: new Date().toISOString() }
            : a
        )
      );
    }
  }

  // Function to refresh messages from the server
  async function refreshMessages() {
    try {
      const response = await fetch('/api/chat');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Convert server messages to our Message format
          const serverMessages: Message[] = data.data.map((msg: any) => ({
            id: msg.id,
            agentId: selectedAgent?.id || 'default',
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content,
            createdAt: msg.created_at,
          }));
          setMessages(serverMessages);
        }
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  }

  function handleCloseBottomSheet() {
    setIsBottomSheetOpen(false);
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
              <BrowserPane agent={selectedAgent} isMobile />
            ) : (
              <ChatPane agent={selectedAgent} messages={messages} onSend={refreshMessages} isMobile />
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
              <BrowserPane agent={selectedAgent} />
            ) : (
              <ChatPane agent={selectedAgent} messages={messages} onSend={refreshMessages} />
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
          <BrowserPane agent={selectedAgent} />
        </div>
        
        {/* Right chat pane - resizable */}
        <ResizablePane
          defaultWidth={380}
          minWidth={300}
          maxWidth={600}
          position="right"
        >
          <ChatPane agent={selectedAgent} messages={messages} onSend={refreshMessages} />
        </ResizablePane>
      </div>
    </>
  );
}


