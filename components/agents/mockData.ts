/**
 * File: components/agents/mockData.ts
 * Purpose: Local mock data for the Agent dashboard UI. Replace with real data
 * sources in the future. All timestamps are ISO strings.
 */
import { Agent, Message } from './types';

export const mockAgents: Agent[] = [
  {
    id: 'a1',
    name: 'Revamp settings UI',
    repo: 'GRAISol/dreamscape',
    branch: 'fix-inter-errors',
    status: 'open',
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    author: 'auto',
    diffStats: { plus: 921, minus: 576 },
  },
  {
    id: 'a2',
    name: 'Fix supabase client',
    repo: 'GRAISol/dreamscape',
    branch: 'upgrade-supabase',
    status: 'ready',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'auto',
    diffStats: { plus: 146, minus: 91 },
  },
  {
    id: 'a3',
    name: 'Implement public user profile',
    repo: 'GRAISol/dreamscape',
    branch: 'public-profile',
    status: 'awaiting',
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'gpt-5',
  },
  {
    id: 'a4',
    name: 'Suggest new color scheme',
    repo: 'GRAISol/dreamscape',
    branch: 'color-scheme',
    status: 'expired',
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'claude-4.5-sonnet',
  },
];

export const mockMessages: Message[] = [
  {
    id: 'm1',
    agentId: 'a1',
    role: 'assistant',
    content: 'I have prepared changes to optimize the settings UI for mobile.',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2',
    agentId: 'a1',
    role: 'user',
    content: 'Focus on the opacity animation and touch targets.',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3',
    agentId: 'a2',
    role: 'assistant',
    content: 'Supabase client has been upgraded; awaiting validation in staging.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];


