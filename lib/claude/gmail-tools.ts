/**
 * Gmail Tools Module
 * 
 * Handles Gmail tool definitions, validation, and execution for the Claude agent.
 * Extracted from claude-agent.ts for better modularity and maintainability.
 */

import { listGmailThreads, sendGmailMessage, markGmailThreadRead } from '@/lib/gmail/client';
import { ToolUse, ToolResult, BrowserToolResult } from '@/types';

// Gmail tool definitions for Claude
export const gmailToolDefinitions = [
  {
    name: 'gmail_list_threads',
    description: 'List recent Gmail threads for the authenticated user with optional query filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Optional Gmail search query (e.g., "from:recruiter@example.com is:unread")'
        },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional Gmail label IDs to filter by.'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of threads to return (1-50).'
        }
      }
    }
  },
  {
    name: 'gmail_send_email',
    description: 'Send a plain text email using the connected Gmail account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Recipient email address(es). Separate multiple with commas.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email body as plain text.' },
        cc: { type: 'string', description: 'Optional CC recipients (comma separated).' },
        bcc: { type: 'string', description: 'Optional BCC recipients (comma separated).' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'gmail_mark_thread_read',
    description: 'Remove the UNREAD label from a Gmail thread.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threadId: { type: 'string', description: 'The Gmail thread ID to mark as read.' }
      },
      required: ['threadId']
    }
  }
];

// Type definitions for Gmail tool inputs
export interface GmailListThreadsToolInput {
  query?: string;
  labelIds?: string[];
  maxResults?: number;
}

export interface GmailSendEmailToolInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface GmailMarkThreadReadToolInput {
  threadId: string;
}

// Validation helper functions
function sanitizeString(value: string, maxLength: number, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} cannot be empty`);
  }
  return trimmed.slice(0, maxLength);
}

function rejectHeaderInjection(value: string, field: string): void {
  if (value.includes('\r') || value.includes('\n')) {
    throw new Error(`${field} cannot contain newline characters`);
  }
}

export function validateListThreadsInput(raw: Record<string, unknown>): GmailListThreadsToolInput {
  const input: GmailListThreadsToolInput = {};

  if (raw.query !== undefined) {
    if (typeof raw.query !== 'string') {
      throw new Error('gmail_list_threads.query must be a string');
    }
    input.query = raw.query.trim().slice(0, 1024);
  }

  if (raw.labelIds !== undefined) {
    if (!Array.isArray(raw.labelIds) || raw.labelIds.some(label => typeof label !== 'string')) {
      throw new Error('gmail_list_threads.labelIds must be an array of strings');
    }
    input.labelIds = (raw.labelIds as string[]).slice(0, 10).map(label => label.trim()).filter(Boolean);
  }

  if (raw.maxResults !== undefined) {
    const parsed = Number(raw.maxResults);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new Error('gmail_list_threads.maxResults must be an integer between 1 and 50');
    }
    input.maxResults = parsed;
  }

  return input;
}

export function validateSendEmailInput(raw: Record<string, unknown>): GmailSendEmailToolInput {
  const to = sanitizeString(String(raw.to ?? ''), 512, 'gmail_send_email.to');
  rejectHeaderInjection(to, 'gmail_send_email.to');
  if (!to.includes('@')) {
    throw new Error('gmail_send_email.to must contain at least one email address');
  }

  const subject = sanitizeString(String(raw.subject ?? ''), 256, 'gmail_send_email.subject');
  rejectHeaderInjection(subject, 'gmail_send_email.subject');
  const bodyValue = sanitizeString(String(raw.body ?? ''), 5000, 'gmail_send_email.body');

  const cc = raw.cc ? sanitizeString(String(raw.cc), 512, 'gmail_send_email.cc') : undefined;
  if (cc) {
    rejectHeaderInjection(cc, 'gmail_send_email.cc');
  }
  const bcc = raw.bcc ? sanitizeString(String(raw.bcc), 512, 'gmail_send_email.bcc') : undefined;
  if (bcc) {
    rejectHeaderInjection(bcc, 'gmail_send_email.bcc');
  }

  return {
    to,
    subject,
    body: bodyValue,
    cc,
    bcc
  };
}

export function validateMarkThreadReadInput(raw: Record<string, unknown>): GmailMarkThreadReadToolInput {
  const threadId = sanitizeString(String(raw.threadId ?? ''), 256, 'gmail_mark_thread_read.threadId');
  return { threadId };
}

/**
 * Execute a Gmail tool based on the tool use request
 */
export async function executeGmailTool(toolUse: ToolUse, userId: string): Promise<BrowserToolResult> {
  const input = toolUse.input as Record<string, any>;
  
  switch (toolUse.name) {
    case 'gmail_list_threads': {
      const listInput = validateListThreadsInput(input);
      const threads = await listGmailThreads(userId, listInput);
      return {
        success: true,
        data: {
          count: threads.length,
          threads: threads.map(thread => ({
            id: thread.id,
            historyId: thread.historyId,
            snippet: thread.snippet
          }))
        },
        message: `Retrieved ${threads.length} Gmail thread${threads.length === 1 ? '' : 's'}`
      };
    }
    
    case 'gmail_send_email': {
      const emailInput = validateSendEmailInput(input);
      const sendResult = await sendGmailMessage(userId, emailInput);
      return {
        success: true,
        data: { id: sendResult.id },
        message: 'Email sent with Gmail'
      };
    }
    
    case 'gmail_mark_thread_read': {
      const markInput = validateMarkThreadReadInput(input);
      await markGmailThreadRead(userId, markInput.threadId);
      return {
        success: true,
        data: { threadId: markInput.threadId },
        message: 'Thread marked as read'
      };
    }
    
    default:
      throw new Error(`Unknown Gmail tool: ${toolUse.name}`);
  }
}