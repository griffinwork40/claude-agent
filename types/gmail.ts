// types/gmail.ts
// Purpose: Shared TypeScript interfaces for Gmail credential and API responses.

export interface GmailCredentialRecord {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  access_token_expires_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GmailCredentialRecordInput {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  tokenType: string | null;
  accessTokenExpiresAt: string | null;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  internalDate: string;
}
