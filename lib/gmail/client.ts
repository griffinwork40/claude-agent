// lib/gmail/client.ts
// Purpose: Encapsulate Gmail OAuth2 handling and REST helpers for listing threads, sending messages, and marking threads read.

import { deleteGmailCredentials, getGmailCredentials, upsertGmailCredentials } from '@/lib/supabase/gmail-credentials';

const AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface GmailCredentialPayload {
  accessToken: string;
  refreshToken: string;
  expiry: string;
}

export interface ListThreadsOptions {
  query?: string;
  labelIds?: string[];
  maxResults?: number;
}

export interface GmailThreadSummary {
  id: string;
  historyId?: string;
  snippet?: string;
}

export interface GmailSendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function computeExpiry(expiresIn: number): string {
  const bufferMs = 60 * 1000;
  const expiry = Date.now() + expiresIn * 1000 - bufferMs;
  return new Date(expiry).toISOString();
}

async function postForm(url: string, form: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google OAuth request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<TokenResponse>;
}

async function refreshTokens(existingRefreshToken: string): Promise<GmailCredentialPayload> {
  if (!existingRefreshToken) {
    throw new Error('Missing refresh token for Gmail credential refresh');
  }

  const clientId = getEnvOrThrow('GOOGLE_CLIENT_ID');
  const clientSecret = getEnvOrThrow('GOOGLE_CLIENT_SECRET');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: existingRefreshToken,
    grant_type: 'refresh_token'
  });

  const tokens = await postForm(TOKEN_URL, params);
  if (!tokens.access_token || !tokens.expires_in) {
    throw new Error('Invalid refresh token response from Google');
  }

  const refreshToken = tokens.refresh_token ?? existingRefreshToken;
  return {
    accessToken: tokens.access_token,
    refreshToken,
    expiry: computeExpiry(tokens.expires_in)
  };
}

async function ensureValidCredentials(userId: string): Promise<GmailCredentialPayload> {
  const record = await getGmailCredentials(userId);
  if (!record) {
    throw new Error('No Gmail credentials found for user');
  }

  const expiryTime = Date.parse(record.expiry);
  if (Number.isNaN(expiryTime)) {
    throw new Error('Stored Gmail credentials contain invalid expiry timestamp');
  }

  if (expiryTime > Date.now()) {
    return {
      accessToken: record.access_token,
      refreshToken: record.refresh_token,
      expiry: record.expiry
    };
  }

  const refreshed = await refreshTokens(record.refresh_token);
  await upsertGmailCredentials({
    userId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiry: refreshed.expiry
  });
  return refreshed;
}

async function gmailFetch(
  userId: string,
  path: string,
  init: (RequestInit & { retry?: boolean }) = {}
): Promise<Response> {
  const { retry, headers, ...rest } = init;
  const credentials = await ensureValidCredentials(userId);
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(headers || {}),
      Authorization: `Bearer ${credentials.accessToken}`,
      ...(rest.body && !(headers instanceof Headers) && !(headers as Record<string, unknown>)?.['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {})
    }
  });

  if (response.status === 401 && retry !== false) {
    const refreshed = await refreshTokens(credentials.refreshToken);
    await upsertGmailCredentials({
      userId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiry: refreshed.expiry
    });
    return gmailFetch(userId, path, { ...rest, headers, retry: false });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API request failed (${response.status}): ${errorBody}`);
  }

  return response;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function buildOAuthConsentUrl(state: string): string {
  if (!state) {
    throw new Error('State parameter is required for OAuth consent URL');
  }

  const clientId = getEnvOrThrow('GOOGLE_CLIENT_ID');
  const redirectUri = getEnvOrThrow('GOOGLE_OAUTH_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: SCOPES.join(' '),
    state
  });

  return `${AUTH_BASE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(userId: string, code: string): Promise<GmailCredentialPayload> {
  if (!code) {
    throw new Error('Authorization code is required');
  }

  const clientId = getEnvOrThrow('GOOGLE_CLIENT_ID');
  const clientSecret = getEnvOrThrow('GOOGLE_CLIENT_SECRET');
  const redirectUri = getEnvOrThrow('GOOGLE_OAUTH_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });

  const tokens = await postForm(TOKEN_URL, params);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
    throw new Error('Incomplete token response received from Google');
  }

  const payload: GmailCredentialPayload = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiry: computeExpiry(tokens.expires_in)
  };

  await upsertGmailCredentials({
    userId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiry: payload.expiry
  });

  return payload;
}

export async function listGmailThreads(userId: string, options: ListThreadsOptions = {}): Promise<GmailThreadSummary[]> {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  if (options.maxResults) params.set('maxResults', options.maxResults.toString());
  if (options.labelIds?.length) {
    for (const label of options.labelIds) {
      params.append('labelIds', label);
    }
  }

  const queryString = params.toString();
  const response = await gmailFetch(userId, queryString ? `/threads?${queryString}` : '/threads');
  const data = await response.json() as { threads?: GmailThreadSummary[] };
  return data.threads ?? [];
}

export async function sendGmailMessage(userId: string, input: GmailSendEmailInput): Promise<{ id: string }> {
  if (!input.to || !input.subject || !input.body) {
    throw new Error('sendGmailMessage requires to, subject, and body fields');
  }

  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset="UTF-8"'
  ];

  if (input.cc) headers.push(`Cc: ${input.cc}`);
  if (input.bcc) headers.push(`Bcc: ${input.bcc}`);

  const message = `${headers.join('\r\n')}\r\n\r\n${input.body}`;
  const raw = toBase64Url(message);

  const response = await gmailFetch(userId, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw })
  });

  const data = await response.json() as { id: string };
  if (!data.id) {
    throw new Error('Gmail send message response missing id');
  }

  return data;
}

export async function markGmailThreadRead(userId: string, threadId: string): Promise<void> {
  if (!threadId) {
    throw new Error('Thread ID is required to mark Gmail thread as read');
  }

  await gmailFetch(userId, `/threads/${threadId}/modify`, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
  });
}

export async function disconnectGmailAccount(userId: string): Promise<void> {
  await deleteGmailCredentials(userId);
}
