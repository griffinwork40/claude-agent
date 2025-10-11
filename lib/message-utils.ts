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

export interface Conversation {
  id: string;
  user_id: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Load conversations from the API
 */
export async function loadConversationsFromAPI(includeArchived: boolean = false): Promise<Conversation[]> {
  try {
    const url = `/api/conversations/archive?includeArchived=${includeArchived}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to load conversations:', response.status, response.statusText);
      return [];
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      console.error('Invalid response format:', result);
      return [];
    }

    return result.data;
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

/**
 * Archive or unarchive a conversation
 */
export async function archiveConversation(conversationId: string, archived: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/conversations/archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, archived }),
    });

    if (!response.ok) {
      console.error('Failed to archive conversation:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error archiving conversation:', error);
    return false;
  }
}
