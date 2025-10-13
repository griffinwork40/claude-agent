// lib/gmail/markThreadAsRead.ts
// Purpose: Mark a Gmail thread as read by removing the UNREAD label.

import { getValidGmailAccessToken } from './getValidAccessToken';

/**
 * Remove the UNREAD label from a Gmail thread.
 * @param userId - Authenticated Supabase user identifier.
 * @param threadId - Gmail thread identifier to update.
 */
export async function markGmailThreadAsRead(userId: string, threadId: string): Promise<void> {
  if (!threadId) {
    throw new Error('threadId is required to modify Gmail threads.');
  }

  const { accessToken } = await getValidGmailAccessToken(userId);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to mark Gmail thread as read: ${response.status} ${response.statusText} ${JSON.stringify(errorBody)}`);
  }
}
