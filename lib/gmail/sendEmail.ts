// lib/gmail/sendEmail.ts
// Purpose: Send an email through Gmail on behalf of an authenticated user.

import { Buffer } from 'node:buffer';
import { getValidGmailAccessToken } from './getValidAccessToken';

export interface SendGmailOptions {
  to: string;
  subject: string;
  body: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send an email with the Gmail API using the stored OAuth credentials.
 * @param userId - Authenticated Supabase user identifier.
 * @param options - Recipient, subject, and body for the outgoing message.
 */
export async function sendGmailMessage(userId: string, options: SendGmailOptions): Promise<string> {
  if (!EMAIL_REGEX.test(options.to)) {
    throw new Error('A valid recipient email address is required.');
  }

  const trimmedSubject = options.subject.trim();
  if (!trimmedSubject) {
    throw new Error('Email subject cannot be empty.');
  }

  const body = options.body.trim();
  if (!body) {
    throw new Error('Email body cannot be empty.');
  }

  const { accessToken } = await getValidGmailAccessToken(userId);
  const message = [
    `To: ${options.to}`,
    `Subject: ${trimmedSubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ].join('\r\n');

  const rawMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawMessage })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to send Gmail message: ${response.status} ${response.statusText} ${JSON.stringify(errorBody)}`);
  }

  const payload = await response.json();
  if (!payload.id) {
    throw new Error('Gmail send response did not include a message ID.');
  }

  return payload.id as string;
}
