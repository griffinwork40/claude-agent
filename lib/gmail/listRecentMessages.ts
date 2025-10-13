// lib/gmail/listRecentMessages.ts
// Purpose: Retrieve recent Gmail messages for an authenticated user via the REST API.

import { getValidGmailAccessToken } from './getValidAccessToken';
import { GmailMessageSummary } from '@/types/gmail';

export interface ListRecentMessagesOptions {
  maxResults?: number;
  unreadOnly?: boolean;
}

/**
 * Fetch a summary of recent Gmail messages for the supplied user.
 * @param userId - Authenticated Supabase user identifier.
 * @param options - Optional filters for unread status and pagination size.
 */
export async function listRecentGmailMessages(
  userId: string,
  options: ListRecentMessagesOptions = {}
): Promise<GmailMessageSummary[]> {
  const { accessToken } = await getValidGmailAccessToken(userId);
  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 50);

  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: 'INBOX'
  });

  if (options.unreadOnly) {
    params.set('q', 'is:unread');
  }

  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!listResponse.ok) {
    const errorBody = await listResponse.json().catch(() => ({}));
    throw new Error(`Failed to list Gmail messages: ${listResponse.status} ${listResponse.statusText} ${JSON.stringify(errorBody)}`);
  }

  const listPayload = await listResponse.json();
  if (!Array.isArray(listPayload.messages) || listPayload.messages.length === 0) {
    return [];
  }

  const summaries: GmailMessageSummary[] = [];
  for (const item of listPayload.messages) {
    if (!item.id) {
      continue;
    }

    const detailParams = new URLSearchParams({ format: 'metadata' });
    detailParams.append('metadataHeaders', 'Subject');
    detailParams.append('metadataHeaders', 'From');

    const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?${detailParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!detailResponse.ok) {
      const errorBody = await detailResponse.json().catch(() => ({}));
      throw new Error(`Failed to load Gmail message ${item.id}: ${detailResponse.status} ${detailResponse.statusText} ${JSON.stringify(errorBody)}`);
    }

    const detail = await detailResponse.json();
    const headers = Array.isArray(detail.payload?.headers) ? detail.payload.headers : [];
    const subjectHeader = headers.find((header: { name?: string }) => header.name?.toLowerCase() === 'subject');
    const fromHeader = headers.find((header: { name?: string }) => header.name?.toLowerCase() === 'from');

    summaries.push({
      id: detail.id,
      threadId: detail.threadId,
      subject: subjectHeader?.value ?? '(no subject)',
      from: fromHeader?.value ?? '(unknown sender)',
      snippet: detail.snippet ?? '',
      internalDate: detail.internalDate ?? ''
    });
  }

  return summaries;
}
