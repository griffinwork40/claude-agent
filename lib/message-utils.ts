/**
 * File: lib/message-utils.ts
 * Purpose: Utility functions for converting between database messages and frontend message format
 */

import { Message } from '@/components/agents/types';

export interface DatabaseMessage {
  id: string;
  user_id: string;
  content: string;
  sender: 'user' | 'bot';
  session_id?: string;
  job_opportunity?: any;
  created_at: string;
}

/**
 * Convert database message format to frontend Message format
 */
export function convertDatabaseMessageToMessage(dbMessage: DatabaseMessage): Message {
  return {
    id: dbMessage.id,
    agentId: dbMessage.session_id || 'default-agent', // Use session_id from database, fallback to default
    role: dbMessage.sender === 'bot' ? 'assistant' : 'user',
    content: dbMessage.content,
    createdAt: dbMessage.created_at,
  };
}

/**
 * Convert multiple database messages to frontend Message format
 */
export function convertDatabaseMessagesToMessages(dbMessages: DatabaseMessage[]): Message[] {
  return dbMessages.map(convertDatabaseMessageToMessage);
}

/**
 * Load messages from the API
 */
export async function loadMessagesFromAPI(agentId?: string): Promise<Message[]> {
  try {
    const url = agentId ? `/api/chat?agentId=${encodeURIComponent(agentId)}` : '/api/chat';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to load messages:', response.status, response.statusText);
      return [];
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      console.error('Invalid response format:', result);
      return [];
    }

    return convertDatabaseMessagesToMessages(result.data);
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
}
