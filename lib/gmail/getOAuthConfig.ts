// lib/gmail/getOAuthConfig.ts
// Purpose: Read and validate Google OAuth configuration from environment variables.

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Load Gmail OAuth configuration values from environment variables.
 * @returns Validated configuration for initiating OAuth flows.
 */
export function getGmailOAuthConfig(): GmailOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const scopesEnv = process.env.GOOGLE_GMAIL_SCOPES || 'https://www.googleapis.com/auth/gmail.modify';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not fully configured.');
  }

  const scopes = scopesEnv
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  if (scopes.length === 0) {
    throw new Error('At least one Gmail scope must be specified.');
  }

  return { clientId, clientSecret, redirectUri, scopes };
}
