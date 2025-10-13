// lib/gmail/tools.ts
// Purpose: Define Gmail tool schemas for Claude tool calling.

export const gmailTools = [
  {
    name: 'gmail_list_messages',
    description: 'List recent Gmail messages for the authenticated user. Returns sender, subject, and snippets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of messages to return (1-50).'
        },
        unreadOnly: {
          type: 'boolean',
          description: 'When true, only include unread messages.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'gmail_send_email',
    description: 'Send an email using the user\'s Gmail account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address.'
        },
        subject: {
          type: 'string',
          description: 'Email subject line.'
        },
        body: {
          type: 'string',
          description: 'Plain text email body.'
        }
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false
    }
  },
  {
    name: 'gmail_mark_thread_read',
    description: 'Mark a Gmail thread as read by removing the UNREAD label.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threadId: {
          type: 'string',
          description: 'Gmail thread identifier to mark as read.'
        }
      },
      required: ['threadId'],
      additionalProperties: false
    }
  }
];
