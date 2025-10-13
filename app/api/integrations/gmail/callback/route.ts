// app/api/integrations/gmail/callback/route.ts
// Purpose: Handle Google OAuth callback, store Gmail tokens, and redirect users back to the dashboard.

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { exchangeAuthorizationCode } from '@/lib/gmail/exchangeAuthorizationCode';
import { saveGmailCredentials } from '@/lib/supabase/gmail/saveGmailCredentials';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/gmail/callback
 * Validate the OAuth state parameter, exchange the authorization code, and persist Gmail tokens.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code.' }, { status: 400 });
  }

  if (!state) {
    return NextResponse.json({ error: 'Missing OAuth state parameter.' }, { status: 400 });
  }

  const cookieStore = cookies();
  const storedState = cookieStore.get('gmail_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: 'Invalid OAuth state.' }, { status: 400 });
  }

  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await exchangeAuthorizationCode(code);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    await saveGmailCredentials({
      userId: session.user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      accessTokenExpiresAt: expiresAt
    });

    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('gmail', 'connected');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: 'gmail_oauth_state',
      value: '',
      maxAge: 0,
      path: '/'
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process Gmail OAuth callback.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
