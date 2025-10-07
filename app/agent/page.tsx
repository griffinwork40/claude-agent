/**
 * File: app/agent/page.tsx
 * Purpose: /agent page composing the three-pane dashboard UI using mock data.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Agent, Message } from '@/components/agents/types';
import { AgentList, BrowserPane, ChatPane } from '@/components/agents';
import { mockAgents, mockMessages } from '@/components/agents/mockData';

export default function AgentPage() {
  const search = useSearchParams();
  const router = useRouter();

  const initialId = search.get('agentId');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialId ?? (mockAgents[0]?.id ?? null)
  );
  const [messages, setMessages] = useState<Message[]>(mockMessages);

  const selectedAgent: Agent | null = useMemo(() => {
    return mockAgents.find((a) => a.id === selectedAgentId) ?? null;
  }, [selectedAgentId]);

  function handleSelect(agentId: string) {
    setSelectedAgentId(agentId);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('agentId', agentId);
    router.push(`?${params.toString()}`);
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
  }

  return (
    <div className="h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_380px] gap-3 p-3 bg-[var(--bg)] text-[var(--fg)]">
      <AgentList selectedAgentId={selectedAgentId} onSelect={handleSelect} />
      <BrowserPane agent={selectedAgent} />
      <ChatPane agent={selectedAgent} messages={messages} onSend={handleSend} />
    </div>
  );
}


