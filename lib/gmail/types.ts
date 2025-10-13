// lib/gmail/types.ts
// Purpose: Local helper interfaces for Gmail OAuth and API requests.

export interface GmailOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  expiry_date?: number;
}

export interface GmailAccessTokenResult {
  accessToken: string;
  expiresAt: number | null;
}
